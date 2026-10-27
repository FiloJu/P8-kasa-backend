function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getThreadForUser(db, threadId, userId) {
  const thread = await db.getAsync(`
    SELECT id, property_id, client_id, owner_id, created_at, updated_at
    FROM messaging_threads
    WHERE id = ? AND (client_id = ? OR owner_id = ?)
  `, [threadId, userId, userId]);
  if (!thread) throw httpError('Thread not found', 404);
  return thread;
}

async function listThreads(db, userId) {
  return db.allAsync(`
    SELECT t.id, t.property_id, t.client_id, t.owner_id, t.created_at, t.updated_at,
      p.title AS property_title, p.cover AS property_cover,
      client.name AS client_name, client.picture AS client_picture,
      owner.name AS owner_name, owner.picture AS owner_picture,
      message.id AS last_message_id, message.sender_id AS last_message_sender_id,
      message.body AS last_message_body, message.created_at AS last_message_at
    FROM messaging_threads t
    JOIN properties p ON p.id = t.property_id
    JOIN users client ON client.id = t.client_id
    JOIN users owner ON owner.id = t.owner_id
    LEFT JOIN messaging_messages message ON message.id = (
      SELECT id FROM messaging_messages WHERE thread_id = t.id ORDER BY id DESC LIMIT 1
    )
    WHERE t.client_id = ? OR t.owner_id = ?
    ORDER BY COALESCE(message.created_at, t.updated_at) DESC, t.id DESC
  `, [userId, userId]);
}

async function startThread(db, user, { propertyId, recipientId, message, body, content }) {
  if (!propertyId) throw httpError('propertyId is required', 400);
  const property = await db.getAsync('SELECT id, host_id FROM properties WHERE id = ?', [String(propertyId)]);
  if (!property) throw httpError('Property not found', 404);

  let clientId;
  let ownerId;
  if (String(user.id) === String(property.host_id)) {
    if (!recipientId) throw httpError('recipientId is required for property owners', 400);
    clientId = Number(recipientId);
    ownerId = Number(user.id);
    const client = await db.getAsync('SELECT id FROM users WHERE id = ? AND role = ?', [clientId, 'client']);
    if (!client) throw httpError('Client not found', 404);
  } else {
    if (user.role !== 'client') throw httpError('Only clients and property owners can start a thread', 403);
    clientId = Number(user.id);
    ownerId = Number(property.host_id);
  }

  await db.runAsync(`
    INSERT OR IGNORE INTO messaging_threads(property_id, client_id, owner_id)
    VALUES (?, ?, ?)
  `, [String(property.id), clientId, ownerId]);
  const thread = await db.getAsync(`
    SELECT id FROM messaging_threads WHERE property_id = ? AND client_id = ? AND owner_id = ?
  `, [String(property.id), clientId, ownerId]);

  const initialMessage = [message, body, content].find(value => typeof value === 'string' && value.trim());
  if (initialMessage) {
    await sendMessage(db, thread.id, user.id, initialMessage);
  }

  return { threadId: thread.id, id: thread.id };
}

async function listMessages(db, threadId, userId) {
  await getThreadForUser(db, threadId, userId);
  return db.allAsync(`
    SELECT m.id, m.thread_id, m.sender_id, m.body, m.created_at,
      u.name AS sender_name, u.picture AS sender_picture
    FROM messaging_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.thread_id = ?
    ORDER BY m.id ASC
  `, [threadId]);
}

async function sendMessage(db, threadId, userId, input) {
  const thread = await getThreadForUser(db, threadId, userId);
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) throw httpError('message is required', 400);
  const result = await db.runAsync(
    'INSERT INTO messaging_messages(thread_id, sender_id, body) VALUES (?, ?, ?)',
    [thread.id, userId, text]
  );
  await db.runAsync('UPDATE messaging_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [thread.id]);
  return db.getAsync(`
    SELECT id, thread_id, sender_id, body, created_at
    FROM messaging_messages WHERE id = ?
  `, [result.lastID]);
}

module.exports = { listThreads, startThread, listMessages, sendMessage };