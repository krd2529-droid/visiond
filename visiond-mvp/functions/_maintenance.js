const iso=value=>new Date(value).toISOString();

export async function claimMaintenanceLease(db,jobKey,{now=Date.now,leaseMs=120000,minIntervalMs=0,table='maintenance_job_leases'}={}){
  const started=Number(now()),nowIso=iso(started),expiresIso=iso(started+leaseMs),token=crypto.randomUUID();
  const row=await db.prepare(`INSERT INTO ${table}(job_key,lease_token,lease_expires_at,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(job_key) DO UPDATE SET lease_token=excluded.lease_token,lease_expires_at=excluded.lease_expires_at,updated_at=excluded.updated_at
    WHERE (${table}.lease_expires_at IS NULL OR ${table}.lease_expires_at<=excluded.updated_at)
      AND (${table}.last_completed_at IS NULL OR ${table}.last_completed_at<=?)
    RETURNING lease_token`).bind(jobKey,token,expiresIso,nowIso,iso(started-minIntervalMs)).first();
  return row?.lease_token===token?{token,started,nowIso}:null;
}

export async function releaseMaintenanceLease(db,jobKey,lease,{now=Date.now,completed=true,table='maintenance_job_leases'}={}){
  const finished=iso(Number(now()));
  return db.prepare(`UPDATE ${table} SET lease_token='',lease_expires_at=NULL,last_completed_at=CASE WHEN ? THEN ? ELSE last_completed_at END,updated_at=? WHERE job_key=? AND lease_token=?`).bind(completed?1:0,finished,finished,jobKey,lease.token).run();
}
