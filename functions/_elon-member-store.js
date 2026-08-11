import {elonWebDb} from './_elon_databases.js';

export async function ownElonConversation(env,id,userId,activeOnly=false){
  if(!id)return null;
  const db=elonWebDb(env),subjectId=String(userId);
  return db.prepare(`SELECT id,title,status,created_at,COALESCE((SELECT MAX(activity.created_at) FROM elon_web_messages activity WHERE activity.conversation_id=c.id),c.created_at) updated_at,ended_at FROM elon_web_conversations c WHERE id=? AND subject_id=? AND datetime(COALESCE((SELECT MAX(m.created_at) FROM elon_web_messages m WHERE m.conversation_id=c.id),c.created_at))>=datetime('now','-60 days')${activeOnly?" AND status='active'":''}`).bind(id,subjectId).first();
}

export async function createElonConversation(env,userId,title,subjectType='member'){
  const db=elonWebDb(env),id=`ew_${crypto.randomUUID()}`,subjectId=String(userId);
  const type=subjectType==='guest'?'guest':'member';
  await db.prepare("INSERT INTO elon_web_conversations(id,subject_type,subject_id,title,status) VALUES(?,?,?,?,'active')").bind(id,type,subjectId,title).run();
  return {id,title,status:'active'};
}

export async function loadElonMessages(env,conversationId,userId,limit=50){
  return (await elonWebDb(env).prepare(`SELECT id,role,content,page_path,page_title,page_context,created_at FROM elon_web_messages WHERE conversation_id=? AND subject_id=? ORDER BY id DESC LIMIT ?`).bind(conversationId,String(userId),limit).all()).results||[];
}

export async function loadElonProviderHistory(env,conversationId,userId,limit){
  return (await elonWebDb(env).prepare(`SELECT role,content FROM elon_web_messages WHERE conversation_id=? AND subject_id=? AND page_context NOT LIKE '%"error":true%' ORDER BY id DESC LIMIT ?`).bind(conversationId,String(userId),limit).all()).results||[];
}

export async function persistElonExchange(env,conversationId,userId,message,answer,pageContext){
  const contextJson=JSON.stringify(pageContext);
  const db=elonWebDb(env),subjectId=String(userId);
  await db.batch([
    db.prepare(`INSERT INTO elon_web_messages(conversation_id,subject_id,role,content,page_path,page_title,page_context) VALUES(?,?,'user',?,?,?,?)`).bind(conversationId,subjectId,message,pageContext.path||'',pageContext.title||'',contextJson),
    db.prepare(`INSERT INTO elon_web_messages(conversation_id,subject_id,role,content,page_path,page_title,page_context) VALUES(?,?,'assistant',?,?,?,?)`).bind(conversationId,subjectId,answer,pageContext.path||'',pageContext.title||'',contextJson),
    db.prepare('UPDATE elon_web_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND subject_id=?').bind(conversationId,subjectId)
  ]);
}
