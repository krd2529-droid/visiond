export async function ownElonConversation(env,id,userId,activeOnly=false){
  if(!id)return null;
  return env.DB.prepare(`SELECT id,title,status,created_at,COALESCE((SELECT MAX(activity.created_at) FROM elon_messages activity WHERE activity.conversation_id=c.id),c.created_at) updated_at,ended_at FROM elon_conversations c WHERE id=? AND user_id=? AND datetime(COALESCE((SELECT MAX(m.created_at) FROM elon_messages m WHERE m.conversation_id=c.id),c.created_at))>=datetime('now','-60 days')${activeOnly?" AND status='active'":''}`).bind(id,userId).first();
}

export async function createElonConversation(env,userId,title){
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO elon_conversations(id,user_id,title,status) VALUES(?,?,?,'active')").bind(id,userId,title).run();
  return {id,title,status:'active'};
}

export async function loadElonMessages(env,conversationId,userId,limit=50){
  return (await env.DB.prepare(`SELECT id,role,content,page_path,page_title,page_context,created_at FROM elon_messages WHERE conversation_id=? AND user_id=? ORDER BY id DESC LIMIT ?`).bind(conversationId,userId,limit).all()).results||[];
}

export async function loadElonProviderHistory(env,conversationId,userId,limit){
  return (await env.DB.prepare(`SELECT role,content FROM elon_messages WHERE conversation_id=? AND user_id=? AND page_context NOT LIKE '%"error":true%' ORDER BY id DESC LIMIT ?`).bind(conversationId,userId,limit).all()).results||[];
}

export async function persistElonExchange(env,conversationId,userId,message,answer,pageContext){
  const contextJson=JSON.stringify(pageContext);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO elon_messages(conversation_id,user_id,role,content,page_path,page_title,page_context) VALUES(?,?,'user',?,?,?,?)`).bind(conversationId,userId,message,pageContext.path||'',pageContext.title||'',contextJson),
    env.DB.prepare(`INSERT INTO elon_messages(conversation_id,user_id,role,content,page_path,page_title,page_context) VALUES(?,?,'assistant',?,?,?,?)`).bind(conversationId,userId,answer,pageContext.path||'',pageContext.title||'',contextJson),
    env.DB.prepare('UPDATE elon_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(conversationId,userId)
  ]);
}
