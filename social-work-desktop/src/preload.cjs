const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (name, ...args) => {
  try { return await ipcRenderer.invoke(name, ...args); }
  catch (error) {
    const message = String(error?.message || '');
    const detail = message.match(/Error invoking remote method '[^']+': Error: (.*)$/);
    throw new Error(detail ? detail[1] : 'ทำรายการไม่สำเร็จ กรุณาลองใหม่');
  }
};
contextBridge.exposeInMainWorld('socialWork', Object.freeze({
  status: () => invoke('app:status'),
  listWorkspaces: cursor => invoke('workspaces:list',cursor),
  createWorkspace: (platform,name) => invoke('workspaces:create',platform,name),
  listJobs: filters => invoke('jobs:list',filters),
  createJob: (workspaceId,instruction) => invoke('jobs:create',workspaceId,instruction),
  getJob: (id,cursor) => invoke('jobs:get',id,cursor),
  editDraft: (id,text) => invoke('jobs:edit',id,text),
  submit: id => invoke('jobs:submit',id),
  approve: (id,reviewer) => invoke('jobs:approve',id,reviewer),
  execute: id => invoke('jobs:execute',id),
  cancel: id => invoke('jobs:cancel',id),
  generate: id => invoke('jobs:generate',id)
}));
