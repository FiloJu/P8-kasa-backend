const messaging = require('../services/messagingService');

function statusFromError(error) {
  return error && error.status ? error.status : 500;
}

async function listThreads(req, res) {
  try {
    const rows = await messaging.listThreads(req.app.locals.db, req.user.id);
    const threads = rows.map(row => ({
      id: row.id,
      threadId: row.id,
      property: { id: row.property_id, title: row.property_title, cover: row.property_cover },
      participants: {
        client: { id: row.client_id, name: row.client_name, picture: row.client_picture },
        owner: { id: row.owner_id, name: row.owner_name, picture: row.owner_picture },
      },
      lastMessage: row.last_message_id ? {
        id: row.last_message_id,
        senderId: row.last_message_sender_id,
        body: row.last_message_body,
        createdAt: row.last_message_at,
      } : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json(threads);
  } catch (error) {
    res.status(statusFromError(error)).json({ error: error.message });
  }
}

async function startThread(req, res) {
  try {
    const thread = await messaging.startThread(req.app.locals.db, req.user, req.body || {});
    res.status(201).json(thread);
  } catch (error) {
    res.status(statusFromError(error)).json({ error: error.message });
  }
}

async function listMessages(req, res) {
  try {
    const messages = await messaging.listMessages(req.app.locals.db, req.params.threadId, req.user.id);
    res.json(messages);
  } catch (error) {
    res.status(statusFromError(error)).json({ error: error.message });
  }
}

async function sendMessage(req, res) {
  try {
    const message = await messaging.sendMessage(
      req.app.locals.db,
      req.params.threadId,
      req.user.id,
      req.body && (req.body.message || req.body.body || req.body.content)
    );
    res.status(201).json(message);
  } catch (error) {
    res.status(statusFromError(error)).json({ error: error.message });
  }
}

module.exports = { listThreads, startThread, listMessages, sendMessage };