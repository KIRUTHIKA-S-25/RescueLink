/**
 * chatService.js
 *
 * Intelligent, role-aware chatbot engine for RescueLink.
 *
 * Supports:
 * - Citizen / Guest assistance: emergency triage guidance, report walkthrough, case tracking, urgency SLA explanation
 * - Rescuer assistance: assigned case lookup, active workload capacity, release rules, evidence requirements
 * - Administrator assistance: live platform metrics, pending/escalated counts, export & analytics navigation
 *
 * Safety & Privacy:
 * - Never hallucinates case statuses or dispatch events — always executes verified DB queries.
 * - Redacts private reporter contact details and rescuer phone numbers.
 * - Flags emergency triggers and prioritizes immediate incident report dispatch.
 * - Graceful fallback: runs rich deterministic rule engine if external AI key is absent or unreachable.
 */

const RescueCase = require('../models/RescueCase');
const User = require('../models/User');
const ResponderProfile = require('../models/ResponderProfile');

// ─── Emergency keywords for citizen safety triage ────────────────────────────
const EMERGENCY_KEYWORDS = [
  'bleeding', 'hit by car', 'run over', 'unconscious', 'dying', 'crushed',
  'fracture', 'broken leg', 'broken bone', 'choking', 'convulsing', 'poisoned',
  'snake bite', 'trapped in drain', 'fire', 'severe injury', 'critical', 'urgent'
];

/**
 * Checks for life-threatening emergency words in the message
 */
const detectEmergency = (text = '') => {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some(kw => lower.includes(kw));
};

/**
 * Extracts a case ID if mentioned in the text (e.g. RC-1712345-ABCD or RC-12345)
 */
const extractCaseId = (text = '') => {
  const match = text.match(/\bRC-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?\b/i);
  return match ? match[0].toUpperCase() : null;
};

/**
 * Executes live DB queries based on user role and query context
 */
const getLiveContext = async ({ message, user }) => {
  const role = user?.role || 'citizen';
  const userId = user?.userId;
  const context = { role };

  const caseId = extractCaseId(message);
  if (caseId) {
    const foundCase = await RescueCase.findOne({ caseId })
      .populate('assignedResponder', 'name email')
      .lean();

    if (foundCase) {
      context.queriedCase = {
        caseId: foundCase.caseId,
        animalType: foundCase.animalType,
        emergencyType: foundCase.emergencyType,
        priority: foundCase.priority,
        status: foundCase.status,
        address: foundCase.location?.address,
        createdAt: foundCase.createdAt,
        isEscalated: foundCase.escalation?.isEscalated || false,
        assignedTo: foundCase.assignedResponder?.name || null,
      };
    } else {
      context.queriedCase = { notFound: true, caseId };
    }
  }

  // Rescuer context
  if (role === 'responder' && userId) {
    const activeCases = await RescueCase.find({
      assignedResponder: userId,
      status: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
    }).select('caseId animalType priority status location.address createdAt').lean();

    const completedCount = await RescueCase.countDocuments({
      assignedResponder: userId,
      status: 'RESCUED'
    });

    context.rescuerStats = {
      activeCount: activeCases.length,
      maxWorkload: 3,
      capacityAvailable: Math.max(0, 3 - activeCases.length),
      activeCases: activeCases.map(c => ({
        caseId: c.caseId,
        animal: c.animalType,
        priority: c.priority,
        status: c.status,
        location: c.location?.address
      })),
      completedCount,
    };
  }

  // Admin context
  if (role === 'admin') {
    const [totalCases, pendingCases, escalatedCases, inProgressCases, rescuedCases, activeRescuers] = await Promise.all([
      RescueCase.countDocuments(),
      RescueCase.countDocuments({ status: 'PENDING' }),
      RescueCase.countDocuments({ status: 'ESCALATED' }),
      RescueCase.countDocuments({ status: { $in: ['ACCEPTED', 'IN_PROGRESS'] } }),
      RescueCase.countDocuments({ status: 'RESCUED' }),
      User.countDocuments({ role: 'responder', isActive: true }),
    ]);

    context.adminMetrics = {
      totalCases,
      pendingCases,
      escalatedCases,
      inProgressCases,
      rescuedCases,
      activeRescuers,
    };
  }

  return context;
};

/**
 * Deterministic fallback response generator (accurate, zero-hallucination)
 */
const generateDeterministicResponse = ({ message, role, liveContext, isEmergency }) => {
  const lower = message.toLowerCase();
  let reply = '';
  const suggestedActions = [];

  // Case ID query response
  if (liveContext.queriedCase) {
    const c = liveContext.queriedCase;
    if (c.notFound) {
      reply = `I searched our live rescue registry, but could not find any case matching reference **${c.caseId}**. Please double-check the case reference format (e.g., RC-...). If you recently submitted it, ensure the submission succeeded.`;
      suggestedActions.push({ label: 'Report New Rescue', path: '/report' });
    } else {
      reply = `### Live Case Status: ${c.caseId}\n` +
        `- **Animal Category:** ${c.animalType}\n` +
        `- **Urgency Level:** ${c.priority}\n` +
        `- **Current Status:** **${c.status}**\n` +
        `- **Location:** ${c.address || 'Location on record'}\n` +
        `- **Reported:** ${new Date(c.createdAt).toLocaleDateString()} ${new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
        (c.isEscalated ? `- ⚠️ **Escalation:** This emergency has been escalated to regional responders due to SLA timeout.\n` : '') +
        (c.assignedTo ? `- **Assignment:** Assigned to rescue volunteer (${c.assignedTo}).\n` : '- **Assignment:** Currently searching nearby available responders.\n');

      if (c.status === 'PENDING') {
        reply += `\n*What to do next:* Our automated spatial matching algorithm has broadcasted alerts to all active rescuers within 15 km. Stay in a safe spot if possible and keep your contact phone available.`;
      } else if (c.status === 'ACCEPTED' || c.status === 'IN_PROGRESS') {
        reply += `\n*What to do next:* A rescuer has accepted this case and is mobilizing to the incident location.`;
      } else if (c.status === 'RESCUED') {
        reply += `\n*Outcome:* Rescue completed! Evidence and treatment notes have been verified on record.`;
      }
      suggestedActions.push({ label: 'View Case & History Details', path: `/rescues/${c.caseId}` });
      return { reply, suggestedActions };
    }
  }

  // ─── ADMIN ROLE INTENTS ──────────────────────────────────────────────────
  if (role === 'admin') {
    if (lower.includes('metric') || lower.includes('stat') || lower.includes('overview') || lower.includes('summary') || lower.includes('dashboard')) {
      const m = liveContext.adminMetrics;
      reply = `### 📊 Live RescueLink System Overview\n\n` +
        `- **Total Rescue Cases:** ${m?.totalCases ?? 0}\n` +
        `- **Pending Awaiting Rescuer:** ${m?.pendingCases ?? 0}\n` +
        `- **Active In-Progress:** ${m?.inProgressCases ?? 0}\n` +
        `- **Escalated (SLA Exceeded):** ${m?.escalatedCases ?? 0}\n` +
        `- **Successfully Rescued:** ${m?.rescuedCases ?? 0}\n` +
        `- **Active Responders:** ${m?.activeRescuers ?? 0}\n\n` +
        `You can review interactive charts, status distributions, response times, and Leaflet incident maps on your Administrator Dashboard.`;
      suggestedActions.push({ label: 'Open Admin Dashboard', path: '/admin' });
      suggestedActions.push({ label: 'Download System Reports', path: '/admin?tab=reports' });
      return { reply, suggestedActions };
    }

    if (lower.includes('pending') || lower.includes('unassigned') || lower.includes('waiting')) {
      const m = liveContext.adminMetrics;
      reply = `There are currently **${m?.pendingCases ?? 0}** pending rescue cases awaiting assignment or responder acceptance. If any case exceeds its SLA (3–15 min depending on urgency), our automated background worker flags it as \`ESCALATED\` and expands search radius to 30km.`;
      suggestedActions.push({ label: 'View Pending in Admin', path: '/admin' });
      return { reply, suggestedActions };
    }

    if (lower.includes('escalat')) {
      const m = liveContext.adminMetrics;
      reply = `There are currently **${m?.escalatedCases ?? 0}** escalated cases requiring administrative attention. Cases auto-escalate when SLA timers lapse:\n` +
        `- **CRITICAL:** 3 minutes SLA\n` +
        `- **HIGH:** 5 minutes SLA\n` +
        `- **MEDIUM:** 10 minutes SLA\n` +
        `- **LOW:** 15 minutes SLA\n\n` +
        `Search radius automatically expands from 15 km to 30 km upon escalation.`;
      suggestedActions.push({ label: 'Review Escalated Cases', path: '/admin' });
      return { reply, suggestedActions };
    }

    if (lower.includes('export') || lower.includes('download') || lower.includes('report') || lower.includes('csv') || lower.includes('pdf')) {
      reply = `RescueLink supports comprehensive administrative report exports in **CSV**, **XLSX**, and **PDF** formats. Available reports include:\n` +
        `1. **Complete Rescue Case Report** (all case metadata, status trail, response durations)\n` +
        `2. **Rescue Progress Report** (lifecycle throughput)\n` +
        `3. **Emergency Severity Report** (triage breakdowns)\n` +
        `4. **Rescuer Activity Report** (volunteer assignments, completion rates, response speeds)\n` +
        `5. **Escalation & SLA Audit Report**\n` +
        `6. **Duplicate Incident Report**\n` +
        `7. **Monthly System Progress Report**\n\n` +
        `All exports sanitize against spreadsheet formula injection and log an audit trail entry.`;
      suggestedActions.push({ label: 'Export Reports Center', path: '/admin?tab=reports' });
      return { reply, suggestedActions };
    }
  }

  // ─── RESCUER ROLE INTENTS ────────────────────────────────────────────────
  if (role === 'responder') {
    if (lower.includes('my case') || lower.includes('assigned') || lower.includes('workload') || lower.includes('active')) {
      const r = liveContext.rescuerStats;
      reply = `### 🐾 Your Rescuer Operational Status\n\n` +
        `- **Active Cases:** ${r?.activeCount ?? 0} / ${r?.maxWorkload ?? 3} (Capacity: ${r?.capacityAvailable ?? 0} slots available)\n` +
        `- **Completed Rescues:** ${r?.completedCount ?? 0}\n\n`;

      if (r?.activeCases?.length > 0) {
        reply += `**Current Assigned Cases:**\n`;
        r.activeCases.forEach(c => {
          reply += `- **${c.caseId}** (${c.animal}, ${c.priority}) — Status: \`${c.status}\` @ ${c.location}\n`;
        });
        reply += `\nNext steps: Update progress to \`IN_PROGRESS\` when en route, and upload photographic proof upon rescue completion.`;
      } else {
        reply += `You currently have no active cases in progress. Check the Rescuer Dashboard to accept nearby emergencies within your patrol radius!`;
      }
      suggestedActions.push({ label: 'Go to Rescuer Dashboard', path: '/rescuer' });
      return { reply, suggestedActions };
    }

    if (lower.includes('release') || lower.includes('cannot attend') || lower.includes('cancel')) {
      reply = `### How to Release an Assigned Case:\n` +
        `1. Open the case details from your **Rescuer Dashboard**.\n` +
        `2. Click **Release Case**.\n` +
        `3. You must provide a **mandatory reason** (e.g., vehicle breakdown, en-route delay, safety hazard).\n` +
        `4. Once released, the case immediately reverts to \`PENDING\` and re-alerts nearby rescuers. It frees up 1 slot in your 3-case workload limit.`;
      suggestedActions.push({ label: 'Rescuer Dashboard', path: '/rescuer' });
      return { reply, suggestedActions };
    }

    if (lower.includes('evidence') || lower.includes('proof') || lower.includes('complete') || lower.includes('finish') || lower.includes('photo')) {
      reply = `### Required Proof of Rescue:\n` +
        `RescueLink strictly enforces verifiable completion:\n` +
        `- A **clear photograph** of the rescued animal or clinic handover must be uploaded.\n` +
        `- **Treatment/completion notes** documenting initial care or shelter destination are mandatory.\n` +
        `- Submitting without both will fail with a 400 validation error to ensure data integrity.`;
      suggestedActions.push({ label: 'View Active Cases', path: '/rescuer' });
      return { reply, suggestedActions };
    }

    if (lower.includes('how to accept') || lower.includes('accept')) {
      reply = `To accept a case:\n` +
        `1. Navigate to **Rescuer Dashboard**.\n` +
        `2. In the "Nearby & Available Cases" table, click **Accept Rescue** on any pending case.\n` +
        `3. System verifies you have not reached the 3-case concurrency cap and locks the assignment atomically so other rescuers cannot double-claim it.`;
      suggestedActions.push({ label: 'Rescuer Dashboard', path: '/rescuer' });
      return { reply, suggestedActions };
    }
  }

  // ─── CITIZEN / GENERAL INTENTS ───────────────────────────────────────────
  if (lower.includes('how to report') || lower.includes('report') || lower.includes('found an animal') || lower.includes('injured animal') || lower.includes('help animal')) {
    reply = `### How to Report an Injured or Endangered Animal:\n\n` +
      `1. **Click "Report Rescue"** in the top navigation or use the button below.\n` +
      `2. **Provide Details:**\n` +
      `   - **Animal Category:** Dog, Cat, Bird, Wildlife, Cattle, etc.\n` +
      `   - **Emergency Type:** Injured, Accident, Trapped, Sick, Abandoned.\n` +
      `   - **Observed Condition & Description:** Visible injuries, behavior, hazards.\n` +
      `3. **Pin Location:** Use the interactive map or GPS "Locate Me" button so responders have precise coordinates.\n` +
      `4. **Attach Photo:** A photo greatly helps rescuers prepare appropriate rescue gear.\n` +
      `5. **Submit:** Our Triage Urgency Scoring (TUS) automatically scores the case and dispatches available rescuers within 15 km.`;
    suggestedActions.push({ label: 'Report Rescue Now', path: '/report' });
    return { reply, suggestedActions };
  }

  if (lower.includes('urgency') || lower.includes('priority') || lower.includes('severity') || lower.includes('tus') || lower.includes('triage')) {
    reply = `### RescueLink Urgency & Triage Categories:\n\n` +
      `RescueLink uses an automated **Triage Urgency Scoring (TUS)** formula: \n` +
      `$$TUS = W_{animal} + W_{condition} + W_{location\\_risk}$$\n\n` +
      `- 🔴 **CRITICAL (Score ≥ 75):** Life-threatening accidents, unconsciousness, severe hemorrhage. Automated SLA: **3 minutes** before escalation.\n` +
      `- 🟠 **HIGH (Score 55–74):** Fractures, trapped animals, venomous bites. SLA: **5 minutes**.\n` +
      `- 🟡 **MEDIUM (Score 35–54):** Limping, dehydration, mange, mild sickness. SLA: **10 minutes**.\n` +
      `- 🟢 **LOW (Score < 35):** Stray monitoring, non-urgent abandonment. SLA: **15 minutes**.\n\n` +
      `If no rescuer accepts within the SLA, the case automatically escalates to regional teams and coordinators.`;
    suggestedActions.push({ label: 'Report Emergency', path: '/report' });
    return { reply, suggestedActions };
  }

  if (lower.includes('location') || lower.includes('gps') || lower.includes('map') || lower.includes('pin')) {
    reply = `### Setting the Incident Location:\n\n` +
      `- **Automatic GPS:** Click the "Use My Current Location" button on the Report page. Allow browser location permissions when prompted.\n` +
      `- **Manual Pinning:** You can drag the map or click anywhere on the Leaflet map to drop an exact pin if the animal is down an alley or away from your current position.\n` +
      `- **Address Lookup:** You can also type an approximate street or landmark in the address box.`;
    suggestedActions.push({ label: 'Open Incident Reporter', path: '/report' });
    return { reply, suggestedActions };
  }

  if (lower.includes('duplicate') || lower.includes('same animal') || lower.includes('already reported')) {
    reply = `### Duplicate Report Detection:\n\n` +
      `RescueLink uses spatiotemporal matching. If multiple citizens report the same animal within **100 meters** and **45 minutes**, the system automatically links the additional reports as **Corroborating Reports** under the primary rescue case.\n\n` +
      `This prevents multiple rescue vehicles from being dispatched to the same incident while consolidating all photographic evidence for the responding team!`;
    return { reply, suggestedActions };
  }

  // General First Aid & Animal Treatment Guidance
  if (
    lower.includes('treatment') ||
    lower.includes('first aid') ||
    lower.includes('medicine') ||
    lower.includes('medication') ||
    lower.includes('painkiller') ||
    lower.includes('paracetamol') ||
    lower.includes('wound') ||
    lower.includes('bandage') ||
    lower.includes('cure') ||
    lower.includes('remedy') ||
    lower.includes('care for')
  ) {
    reply = `### 🩹 Animal Emergency First-Aid & Stabilizing Guidance\n\n` +
      `Here are essential steps you can take to keep the animal safe and comfortable while professional help is mobilized:\n\n` +
      `1. **Bleeding & Open Wounds:**\n` +
      `   - Apply gentle, continuous pressure using a clean towel, gauze, or cloth.\n` +
      `   - Do **NOT** apply harsh chemicals, concentrated Dettol, or tourniquets, which can cause tissue necrosis.\n\n` +
      `2. **Fractures & Severe Physical Trauma:**\n` +
      `   - Keep the animal strictly immobilized to prevent secondary spinal or nerve injury.\n` +
      `   - Gently slide a flat board, blanket, or cardboard box underneath the animal to transport or cushion it.\n\n` +
      `3. **Heatstroke & Dehydration:**\n` +
      `   - Move the animal to a shaded, well-ventilated location immediately.\n` +
      `   - Wet their paw pads and ears with cool (not ice-cold) water. Offer small sips of water without forcing.\n\n` +
      `4. 🚫 **CRITICAL WARNING — Human Medications:**\n` +
      `   - **NEVER** administer human medications (such as Paracetamol, Ibuprofen, Aspirin, or Diclofenac). These are **highly toxic** and frequently fatal to dogs and cats.\n\n` +
      `> ⚕️ **Veterinary Medical Disclaimer:** RescueLink is an emergency rescue coordination network and **not a replacement for a licensed veterinary professional**. For serious trauma or illness, submit an emergency report immediately so our rescue network or nearby clinic can provide authorized medical treatment.`;

    suggestedActions.push({ label: 'Report Animal Emergency', path: '/report' });
    return { reply, suggestedActions };
  }

  // Default helpful response
  reply = `Hello! I am **RescueLink AI Assistant**. How can I help you today?\n\n` +
    `- **Report an Emergency:** Ask *"How do I report an injured animal?"*\n` +
    `- **Urgency Guidelines:** Ask *"Explain urgency categories and SLAs"*\n` +
    `- **Track a Case:** Type your case ID (e.g., *"Status of RC-171234-ABCD"*)\n` +
    `- **Location Guidance:** Ask *"How do I use GPS or map pins?"*\n` +
    (role === 'responder' ? `- **Rescuer Tools:** Ask *"What are my active cases?"* or *"How to release a case?"*\n` : '') +
    (role === 'admin' ? `- **Admin Tools:** Ask *"Show live system metrics"* or *"How to export reports?"*\n` : '');

  suggestedActions.push({ label: 'Report Emergency', path: '/report' });
  if (role === 'responder') suggestedActions.push({ label: 'My Rescues', path: '/rescuer' });
  if (role === 'admin') suggestedActions.push({ label: 'Admin Dashboard', path: '/admin' });

  return { reply, suggestedActions };
};

/**
 * Main chat handler: coordinates DB context, emergency banners, external LLM or deterministic fallback
 */
const processChatMessage = async ({ message, user }) => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  const trimmed = message.trim().slice(0, 1000); // limit 1000 chars
  const role = user?.role || 'citizen';
  const isEmergency = detectEmergency(trimmed);

  // 1. Fetch live DB context for verified truth
  const liveContext = await getLiveContext({ message: trimmed, user });

  // 2. Format emergency warning if critical words detected
  let emergencyAlert = null;
  if (isEmergency) {
    emergencyAlert = {
      isEmergency: true,
      message: '⚠️ IMMEDIATE EMERGENCY DETECTED: If this animal has severe life-threatening injuries, do not wait for chat replies! Please submit an Emergency Report right now so nearby rescue units are alerted instantly.',
      actionPath: '/report',
      actionLabel: 'Submit Emergency Report Now',
    };
  }

  // 3. Check for external API integration (Gemini LLM)
  let reply = '';
  let suggestedActions = [];
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (geminiApiKey) {
    const candidateModels = [
      'gemini-3.1-flash-lite-preview',
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
      'gemini-flash-latest',
    ];

    const systemPrompt = `You are RescueLink AI Assistant, an intelligent animal rescue and emergency coordination assistant.
User Role: ${role}.
Live Verified DB Context: ${JSON.stringify(liveContext)}.
Emergency Keywords Detected: ${isEmergency}.

Instructions & Guardrails:
1. Answer ANY user question dynamically and accurately about animal care, general first-aid, wound stabilizing, animal illness, behavior, and rescue guidance.
2. For medical/treatment questions: Give clear stabilizing first-aid advice (clean cloth pressure, keep calm/immobilized, hydration). ALWAYS warn that human medications (Paracetamol, Ibuprofen, Diclofenac) are LETHAL to dogs and cats. Add a clear disclaimer: "RescueLink is an emergency coordination network, not a substitute for licensed veterinary medical treatment."
3. For case tracking: NEVER hallucinate case status or pretend a rescue team is dispatched unless confirmed in Live Verified DB Context. If queriedCase exists in the context, refer to its verified real status.
4. For platform questions: Explain RescueLink's Triage Urgency Scoring (TUS), Leaflet mapping, 15km/30km dispatch radius, and rescuer 3-case workload limits.
5. Tone: Empathetic, professional, concise, structured in GitHub Markdown with bullet points.`;

    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 22000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\nUser Message: ${trimmed}` }],
                },
              ],
              generationConfig: {
                maxOutputTokens: 600,
              },
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const resJson = await response.json();
          const generatedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText && generatedText.trim().length > 0) {
            reply = generatedText.trim();
            console.log(`[CHAT] Generated live LLM response using ${model}`);
            break; // Successfully got response from Gemini
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn(`[CHAT] Model ${model} returned ${response.status}:`, errData.error?.message || response.statusText);
        }
      } catch (err) {
        console.warn(`[CHAT] Attempt with ${model} failed (${err.message}), trying next fallback...`);
      }
    }

    if (reply) {
      // Add contextual actions based on role and query
      if (liveContext.queriedCase?.caseId) {
        suggestedActions.push({ label: 'View Case & History Details', path: `/rescues/${liveContext.queriedCase.caseId}` });
      }
      if (role === 'responder') {
        suggestedActions.push({ label: 'Rescuer Dashboard', path: '/rescuer' });
      } else if (role === 'admin') {
        suggestedActions.push({ label: 'Admin Dashboard', path: '/admin' });
      } else {
        suggestedActions.push({ label: 'Report Emergency', path: '/report' });
      }
    }
  }

  // 4. If no external reply generated, run rich deterministic engine
  if (!reply) {
    const fallbackResult = generateDeterministicResponse({
      message: trimmed,
      role,
      liveContext,
      isEmergency,
    });
    reply = fallbackResult.reply;
    suggestedActions = fallbackResult.suggestedActions;
  }

  return {
    reply,
    emergencyAlert,
    suggestedActions,
    liveContext: {
      queriedCase: liveContext.queriedCase || null,
      role,
    },
  };
};

module.exports = {
  processChatMessage,
  detectEmergency,
  extractCaseId,
  getLiveContext,
};
