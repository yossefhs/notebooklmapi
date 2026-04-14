const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execAsync = util.promisify(exec);

const AUTH_JSON = process.env.NOTEBOOKLM_AUTH_JSON;
const API_KEY   = process.env.NOTEBOOKLM_API_KEY || 'changeme';

function writeAuthIfNeeded() {
  const dir  = path.join(os.homedir(), '.notebooklm');
  const file = path.join(dir, 'storage_state.json');
  if (!fs.existsSync(file) && AUTH_JSON) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, AUTH_JSON, { mode: 0o600 });
  }
}

function authMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Non autorisé' });
  next();
}

module.exports = function (app) {

  app.post('/notebooklm/ask', authMiddleware, async (req, res) => {
    const { notebook, question } = req.body;
    if (!notebook || !question) {
      return res.status(400).json({ error: 'notebook et question sont requis' });
    }
    try {
      writeAuthIfNeeded();
      const { stdout: listOut } = await execAsync('notebooklm list --json');
      const notebooks = JSON.parse(listOut);
      const found = notebooks.find(n =>
        n.title.toLowerCase().includes(notebook.toLowerCase())
      );
      if (!found) {
        return res.status(404).json({
          error: `Notebook "${notebook}" introuvable`,
          available: notebooks.map(n => n.title)
        });
      }
      const safeQ = question.replace(/"/g, '\\"');
      const cmd = `notebooklm use ${found.id} && notebooklm ask "${safeQ}"`;
      const { stdout: answer } = await execAsync(cmd, { timeout: 60000 });
      res.json({
        notebook: found.title,
        question,
        answer: answer.trim(),
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[NotebookLM]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/notebooklm/list', authMiddleware, async (req, res) => {
    try {
      writeAuthIfNeeded();
      const { stdout } = await execAsync('notebooklm list --json');
      const notebooks = JSON.parse(stdout);
      res.json(notebooks.map(n => ({ id: n.id, title: n.title })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const scheduled = [];
  let schedulerInterval = null;

  function startScheduler() {
    if (schedulerInterval) return;
    schedulerInterval = setInterval(async () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const dayNames = ['dim','lun','mar','mer','jeu','ven','sam'];
      const today = dayNames[now.getDay()];
      for (const task of scheduled) {
        if (task.time === hhmm && task.days.includes(today) && !task._ran) {
          task._ran = true;
          try {
            writeAuthIfNeeded();
            const safeQ = task.question.replace(/"/g, '\\"');
            const { stdout: listOut } = await execAsync('notebooklm list --json');
            const notebooks = JSON.parse(listOut);
            const found = notebooks.find(n => n.title.toLowerCase().includes(task.notebook.toLowerCase()));
            if (!found) return;
            const cmd = `notebooklm use ${found.id} && notebooklm ask "${safeQ}"`;
            const { stdout } = await execAsync(cmd, { timeout: 60000 });
            task.lastAnswer = stdout.trim();
            task.lastRun = new Date().toISOString();
          } catch (e) {
            console.error('[Scheduler] Erreur:', e.message);
          }
        }
        if (task.time !== hhmm) task._ran = false;
      }
    }, 30000);
  }

  app.post('/notebooklm/schedule', authMiddleware, (req, res) => {
    const { notebook, question, time, days, label } = req.body;
    if (!notebook || !question || !time) {
      return res.status(400).json({ error: 'notebook, question et time sont requis' });
    }
    const task = {
      id: Date.now().toString(),
      label: label || question.substring(0, 40),
      notebook, question, time,
      days: days || ['lun','mar','mer','jeu','ven','sam','dim'],
      lastAnswer: null, lastRun: null, _ran: false
    };
    scheduled.push(task);
    startScheduler();
    res.json({ success: true, task });
  });

  app.get('/notebooklm/schedule', authMiddleware, (req, res) => {
    res.json(scheduled.map(({ _ran, ...t }) => t));
  });

  app.delete('/notebooklm/schedule/:id', authMiddleware, (req, res) => {
    const idx = scheduled.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Tâche non trouvée' });
    scheduled.splice(idx, 1);
    res.json({ success: true });
  });

  app.get('/notebooklm/schedule/:id/result', authMiddleware, (req, res) => {
    const task = scheduled.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });
    res.json({ label: task.label, lastAnswer: task.lastAnswer, lastRun: task.lastRun });
  });

  console.log('[NotebookLM] Routes enregistrées : /notebooklm/ask | /list | /schedule');
};
