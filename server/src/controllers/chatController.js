/**
 * chatController.js
 *
 * Controller handling incoming chatbot conversations for citizens, rescuers, and admins.
 */

const { processChatMessage } = require('../services/chatService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const handleChat = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return sendError(res, 'Please provide a non-empty chat message', 400);
  }

  if (message.trim().length > 1000) {
    return sendError(res, 'Message exceeds the maximum permitted length of 1000 characters', 400);
  }

  try {
    const result = await processChatMessage({
      message: message.trim(),
      user: req.user || null,
    });

    return sendSuccess(res, result, 'Message processed successfully');
  } catch (err) {
    console.error('[CHAT ERROR]', err);
    return sendError(res, 'Unable to process chat request at this time. Please try again.', 500);
  }
};

module.exports = {
  handleChat,
};
