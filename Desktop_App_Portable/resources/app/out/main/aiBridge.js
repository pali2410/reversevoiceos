// aiBridge.js - VoiceOS Super Agent (v4 - full desktop control)
"use strict";
const fs   = require('fs');
const path = require('path');
const cp   = require('child_process');
const os   = require('os');

const GROQ_API_KEY    = "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";
const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";
const GROQ_STT_MODEL  = "whisper-large-v3-turbo";
const CHROME_EXE      = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DESKTOP_CTRL    = path.join(__dirname, "desktop_control.py");

// ─── Chrome Profiles ─────────────────────────────────────────────────────────
const CHROME_PROFILES = {
  "default":"Default","person 1":"Default",
  "admin":"Profile 33","adminmitnature":"Profile 33",
  "mitnature":"Profile 34",
  "glowdesk":"Profile 20","glowdesk140":"Profile 20",
  "javkdksn":"Profile 22","jack":"Profile 22",
  "vulnora":"Profile 23","joshper":"Profile 24",
  "smartsage":"Profile 11","jiraye":"Profile 11",
  "vyuhverse":"Profile 8",
  "zalaparamveer":"Profile 4","zalaparamveer113":"Profile 4",
  "paramveer113":"Profile 4","paramveer":"Profile 4","jala":"Profile 4",
  "paramveerzala42":"Profile 5",
  "paramveersinhzala113":"Profile 49","paramveersinh":"Profile 49",
  "kiro":"Profile 52","kiro43781":"Profile 52",
  "granthsanch":"Profile 54","granth":"Profile 54",
  "iar":"Profile 45","mscit":"Profile 45",
  "sukrut":"Profile 53",
  "zalaurvashi":"Profile 47","urvashi":"Profile 47",
  "meghal":"Profile 35","meghalgohel":"Profile 35",
  "neev":"Profile 36","mehau":"Profile 39",
};

function resolveProfile(hint) {
  if (!hint) return null;
  const h = hint.toLowerCase().replace(/[^a-z0-9]/g,"");
  for (const [k,v] of Object.entries(CHROME_PROFILES))
    if (h.includes(k.replace(/[^a-z0-9]/g,""))) return v;
  return null;
}

// ─── Conversation Memory ─────────────────────────────────────────────────────
const SESSION_HISTORY = {};
const MAX_HISTORY = 40;
function getHistory(sid) { if (!SESSION_HISTORY[sid]) SESSION_HISTORY[sid]=[]; return SESSION_HISTORY[sid]; }
function pushHistory(sid,role,content) {
  const h=getHistory(sid); h.push({role,content});
  while(h.length>MAX_HISTORY) h.shift();
}

// ─── Voice Map ───────────────────────────────────────────────────────────────
const VOICE_MAP = {
  "jarvis":"en-GB-RyanNeural","xai-leo":"en-GB-RyanNeural",
  "sky":"en-US-JennyNeural","gemini-live-zephyr":"en-US-JennyNeural",
  "dawn":"en-US-AriaNeural","gemini-live-umbriel":"en-US-AriaNeural",
  "dusk":"en-US-GuyNeural","gemini-live-laomedeia":"en-US-GuyNeural",
  "midnight":"en-US-ChristopherNeural","gemini-live-midnight":"en-US-ChristopherNeural",
};

// ─── PCM → WAV ───────────────────────────────────────────────────────────────
function pcmToWav(buf,sr=16000,ch=1,bd=16){
  const h=Buffer.alloc(44);
  h.write("RIFF",0);h.writeUInt32LE(36+buf.length,4);h.write("WAVE",8);h.write("fmt ",12);
  h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(ch,22);h.writeUInt32LE(sr,24);
  h.writeUInt32LE(sr*ch*(bd/8),28);h.writeUInt16LE(ch*(bd/8),32);h.writeUInt16LE(bd,34);
  h.write("data",36);h.writeUInt32LE(buf.length,40);
  return Buffer.concat([h,buf]);
}

// ─── STT ─────────────────────────────────────────────────────────────────────
async function transcribePcm(pcm) {
  try {
    if(!pcm||pcm.length<1000) return "";
    const form=new FormData();
    form.append("file",new Blob([pcmToWav(pcm)],{type:"audio/wav"}),"speech.wav");
    form.append("model",GROQ_STT_MODEL);
    const r=await fetch("https://api.groq.com/openai/v1/audio/transcriptions",{
      method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`},body:form});
    if(!r.ok) return "";
    return((await r.json()).text||"").trim();
  } catch{return "";}
}

async function transcribeStream(stream,mode,hooks) {
  const chunks=[];
  try{for await(const m of stream){if(m?.payload?.case==="audioChunk"&&m?.payload?.value?.audioData)chunks.push(Buffer.from(m.payload.value.audioData));}}catch{}
  const buf=Buffer.concat(chunks);
  if(buf.length<1000) return{transcript:"",securityWarning:false,error:null};
  const t=await transcribePcm(buf);
  try{if(hooks?.onRawTranscriptReady)hooks.onRawTranscriptReady();}catch{}
  return{transcript:t||"",securityWarning:false,error:null};
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
function synthesizeSpeech(text,voiceId="jarvis"){
  return new Promise(resolve=>{
    try{
      const voice=VOICE_MAP[voiceId]||VOICE_MAP[voiceId?.toLowerCase()]||"en-GB-RyanNeural";
      const clean=text.replace(/[*_#`[\]]/g," ").slice(0,400).trim();
      if(!clean) return resolve(null);
      const p=cp.spawn("python",[path.join(__dirname,"tts_helper.py"),clean,voice]);
      const chunks=[];
      p.stdout.on("data",d=>chunks.push(d));
      p.on("close",code=>{
        if(code===0&&chunks.length>0) resolve({audioBase64:Buffer.concat(chunks).toString("base64"),mimeType:"audio/mpeg"});
        else resolve(null);
      });
      p.on("error",()=>resolve(null));
    }catch{resolve(null);}
  });
}

// ─── Desktop Control helper ───────────────────────────────────────────────────
function desktopControl(action,params={}){
  return new Promise(resolve=>{
    try{
      const cmd=JSON.stringify({action,...params});
      const p=cp.spawn("python",[DESKTOP_CTRL],{stdio:["pipe","pipe","pipe"]});
      let out="";
      p.stdout.on("data",d=>out+=d.toString());
      p.on("close",()=>{try{resolve(JSON.parse(out.trim()));}catch{resolve({ok:false,message:out.trim()||"No response"});}});
      p.on("error",e=>resolve({ok:false,message:e.message}));
      p.stdin.write(cmd);
      p.stdin.end();
    }catch(e){resolve({ok:false,message:e.message});}
  });
}

// ─── Shell helpers ────────────────────────────────────────────────────────────
function openUrl(url,profileDir){
  if(profileDir&&fs.existsSync(CHROME_EXE)){
    cp.spawn(CHROME_EXE,[`--profile-directory=${profileDir}`,url],{detached:true,stdio:"ignore"}).unref();
  } else {
    cp.exec(`start "" "${url.replace(/"/g,'')}"`,()=>{});
  }
}
function openApp(target){
  cp.exec(`start "" "${target}"`,err=>{
    if(err) cp.exec(`powershell -c "Start-Process '${target.replace(/'/g,"''")}'"`,()=>{});
  });
}
function runPy(code){
  const tmp=path.join(os.tmpdir(),`vos_${Date.now()}.py`);
  fs.writeFileSync(tmp,code);
  cp.exec(`python "${tmp}"`,(_e,o)=>{
    console.log("[aiBridge] py:",o?.slice(0,200));
    try{fs.unlinkSync(tmp);}catch{}
  });
}
function runPs(script){
  const tmp=path.join(os.tmpdir(),`vos_${Date.now()}.ps1`);
  fs.writeFileSync(tmp,script);
  cp.exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmp}"`,(_e,o)=>{
    console.log("[aiBridge] ps:",o?.slice(0,200));
    try{fs.unlinkSync(tmp);}catch{}
  });
}

// ─── URL / App catalog ────────────────────────────────────────────────────────
const WEB_URLS={
  youtube:"https://www.youtube.com","you tube":"https://www.youtube.com",
  whatsapp:"https://web.whatsapp.com","whats app":"https://web.whatsapp.com",
  instagram:"https://www.instagram.com",facebook:"https://www.facebook.com",
  twitter:"https://www.x.com",x:"https://www.x.com",
  gmail:"https://mail.google.com","google mail":"https://mail.google.com",
  google:"https://www.google.com",chatgpt:"https://chatgpt.com","chat gpt":"https://chatgpt.com",
  claude:"https://claude.ai",reddit:"https://www.reddit.com",
  linkedin:"https://www.linkedin.com",netflix:"https://www.netflix.com",
  github:"https://github.com",notion:"https://www.notion.so",figma:"https://www.figma.com",
  trello:"https://trello.com",twitch:"https://www.twitch.tv",
  tiktok:"https://www.tiktok.com","tik tok":"https://www.tiktok.com",
  amazon:"https://www.amazon.com","google maps":"https://maps.google.com",maps:"https://maps.google.com",
  "google drive":"https://drive.google.com",drive:"https://drive.google.com",
  "google docs":"https://docs.google.com",docs:"https://docs.google.com",
  "google sheets":"https://sheets.google.com",sheets:"https://sheets.google.com",
  "google meet":"https://meet.google.com",meet:"https://meet.google.com",
  outlook:"https://outlook.live.com",onedrive:"https://onedrive.live.com",
  pinterest:"https://www.pinterest.com",dropbox:"https://www.dropbox.com",
  zoom:"https://zoom.us/join",teams:"https://teams.microsoft.com",
  slack:"https://app.slack.com",discord:"https://discord.com/channels/@me",
  telegram:"https://web.telegram.org",spotify:"https://open.spotify.com",
};
const NATIVE_APPS={
  chrome:"chrome","google chrome":"chrome",edge:"msedge","microsoft edge":"msedge",
  firefox:"firefox",brave:"brave",
  notepad:"notepad",calculator:"calc",calc:"calc",
  "vs code":"code",vscode:"code",code:"code",
  terminal:"wt","windows terminal":"wt",cmd:"cmd",powershell:"powershell",
  explorer:"explorer",files:"explorer","file explorer":"explorer",
  paint:"mspaint",settings:"ms-settings:",
  excel:"excel",word:"winword",powerpoint:"powerpnt","task manager":"taskmgr",
};

// ─── Task Parser ──────────────────────────────────────────────────────────────
// ONLY parses short, clearly actionable user commands.
// NEVER called on LLM response text.
function parseTasks(q) {
  if(!q) return null;
  const trimmed = q.trim();
  // Hard guard: if it looks like LLM output, skip
  if(trimmed.length > 120) return null;
  if(/\b(?:I've|I have|I'll|I will|You can|You'll|Let me|Here's|Here is|right from|compatible program|workbook contains|find the file|single sheet)\b/i.test(trimmed)) return null;
  // Must start with an action verb
  if(!/^\b(?:open|launch|start|search|find|play|set|turn|change|create|make|new|minimize|minimise|restore|mute|unmute|close|go to|navigate|message|send|type|volume|can you|please|hey)\b/i.test(trimmed)) return null;

  // ── Pre-check: WhatsApp combined command BEFORE splitting ──────────────
  const waFull=trimmed.match(/(?:open\s+)?whatsapp\s+(?:and\s+)?(?:search|find|message|contact|send.*?to)\s+(.+)/i)
    ||trimmed.match(/(?:search|message|send.*?to|contact)\s+(.+?)\s+(?:on|in|via|through)\s+whatsapp/i);
  if(waFull){
    return[{type:"whatsapp_contact",contact:waFull[1].trim().replace(/\s+(on|in|via|whatsapp|and.*)$/i,"").trim()}];
  }

  const tasks=[];
  const segments=trimmed
    .split(/\bthen\b|\band\s+then\b/i)
    .flatMap(s=>s.split(/\s+and\s+(?=(?:open|launch|search|play|go to|navigate|type|send|create|close|minimize|maximize|scroll|switch|download|find|look up|message|post|read|set|turn|change)\b)/i))
    .map(s=>s.trim()).filter(Boolean);
  for(const seg of segments){
    const t=parseOneSeg(seg);
    if(t) tasks.push(t);
  }
  return tasks.length?tasks:null;
}

function parseOneSeg(seg) {
  const q=seg.trim();
  if(!q||q.length>150) return null;
  const ql=q.toLowerCase();

  // ── Chrome profile ──────────────────────────────────────────────────────
  const profM=q.match(/\b(?:open|switch to|use)\s+(.+?)\s+(?:chrome\s+)?profile/i);
  if(profM){
    const prof=resolveProfile(profM[1].trim());
    return{type:"chrome_profile",profileDir:prof||"Default",hint:profM[1].trim()};
  }

  // ── WhatsApp combined: "open whatsapp and search/message X" ────────────
  // Must check BEFORE splitting — handle the whole query as one unit
  const waFull=q.match(/(?:open\s+)?whatsapp\s+(?:and\s+)?(?:search|find|message|chat|contact|send.*?to)\s+(.+)/i)
    ||q.match(/(?:search|message|send.*?to|contact)\s+(.+?)\s+(?:on|in|via|through)\s+whatsapp/i)
    ||q.match(/(?:message|send\s+(?:a\s+)?message\s+to)\s+(.+?)\s+(?:on\s+)?(?:whatsapp)/i);
  if(waFull){
    return{type:"whatsapp_contact",contact:waFull[1].trim().replace(/\s+(on|in|via|whatsapp|and.*)$/i,"").trim()};
  }

  // ── YouTube search ───────────────────────────────────────────────────────
  const ytSearch=q.match(/\b(?:search|find|look up|play)\s+(.+?)\s+(?:in|on)\s+youtube\b/i)
    ||q.match(/\byoutube\b.{1,20}\b(?:search|find|play)\s+(.+)/i)
    ||q.match(/\bsearch\s+(.+?)\s+(?:song|video|music|channel)\b/i);
  if(ytSearch) return{type:"youtube_search",query:ytSearch[1].trim()};

  // ── Play song (after YouTube context) ───────────────────────────────────
  const playM=q.match(/\b(?:play|listen to)\s+(.+)/i);
  if(playM){
    const pt=playM[1].trim();
    if(!/^any\b|^a\s+(?:song|video|track)/i.test(pt)) return{type:"youtube_search",query:pt};
  }

  // ── Web search ───────────────────────────────────────────────────────────
  const webS=q.match(/\b(?:search|google|look up|find)\s+(?:for\s+)?(.+)/i);
  if(webS&&!/\b(?:in|on)\s+youtube\b/i.test(q)) return{type:"web_search",query:webS[1].trim()};

  // ── Volume exact ─────────────────────────────────────────────────────────
  const volM=q.match(/\b(?:set|turn|change|put)\s+(?:the\s+)?volume\s+(?:to\s+)?(\d+)\s*%?/i)
    ||q.match(/\bvolume\s+(?:to\s+)?(\d+)\s*%?/i);
  if(volM) return{type:"system",action:"vol_set",value:parseInt(volM[1])};
  if(/\bvolume\s+up\b/i.test(q)) return{type:"system",action:"vol_up"};
  if(/\bvolume\s+down\b/i.test(q)) return{type:"system",action:"vol_down"};

  // ── Minimize/restore ─────────────────────────────────────────────────────
  if(/\b(?:minimize|minimise|show desktop)\b/i.test(q)) return{type:"system",action:"minimize"};
  if(/\b(?:restore|unminimize)\b/i.test(q)) return{type:"system",action:"restore"};
  if(/\b(?:mute|unmute)\b/i.test(q)) return{type:"system",action:"mute"};

  // ── Open file ────────────────────────────────────────────────────────────
  const openFileM=q.match(/\bopen\s+(.+?\.[a-zA-Z0-9]{1,5})\s*(?:file\s+)?(?:in|on|from)?\s*(?:my\s+)?(?:desktop|downloads?|documents?)?/i);
  if(openFileM){
    const fname=openFileM[1].trim();
    return{type:"open_file",filename:fname};
  }

  // ── Open URL ─────────────────────────────────────────────────────────────
  if(/^https?:\/\//.test(q)) return{type:"open_url",url:q,label:q};

  // ── Open app/site ─────────────────────────────────────────────────────────
  const openM=q.match(/\b(?:open|launch|start|go to|navigate to|switch to|show)\s+(.+)/i);
  if(openM){
    const target=openM[1].trim().toLowerCase()
      .replace(/\b(?:app|website|page|site|browser)\s*$/,"").trim();
    if(/^https?:\/\//.test(target)) return{type:"open_url",url:target,label:target};
    const url=WEB_URLS[target];
    if(url) return{type:"open_url",url,label:target};
    const app=NATIVE_APPS[target];
    if(app) return{type:"open_app",target:app,label:target};
    if(/\.[a-z]{2,}$/.test(target)) return{type:"open_url",url:`https://${target}`,label:target};
    return{type:"open_app",target,label:target};
  }

  // ── Create file ───────────────────────────────────────────────────────────
  const createM=q.match(/\b(?:create|make|new)\s+(?:a\s+|an\s+)?(?:(.+?)\s+)?(?:file|workbook|document|sheet|spreadsheet)(?:\s+(?:named?|called?)\s+([^\s,]+))?/i);
  if(createM){
    return{type:"create_file",fileType:(createM[1]||"text").trim(),name:createM[2]?.trim()};
  }

  // ── Close app ─────────────────────────────────────────────────────────────
  const closeM=q.match(/\b(?:close|quit|exit|kill)\s+(.+)/i);
  if(closeM) return{type:"close_app",target:closeM[1].trim()};

  return null;
}

// ─── Execute one task ─────────────────────────────────────────────────────────
async function executeTask(task){
  switch(task.type){

    case "open_url":{
      openUrl(task.url,task.profileDir||null);
      return`Opening ${task.label||task.url}.`;
    }

    case "open_app":{
      openApp(task.target);
      return`Opening ${task.label||task.target}.`;
    }

    case "open_file":{
      // Resolve filename to full path
      const desktopPath=path.join(os.homedir(),"Desktop",task.filename);
      const downloadsPath=path.join(os.homedir(),"Downloads",task.filename);
      const docPath=path.join(os.homedir(),"Documents",task.filename);
      const candidates=[task.filename,desktopPath,downloadsPath,docPath];
      let found=null;
      for(const p of candidates){if(fs.existsSync(p)){found=p;break;}}
      if(found){
        cp.exec(`start "" "${found}"`,()=>{});
        return`Opening ${task.filename}.`;
      }
      // Try to find it with PowerShell search
      cp.exec(`powershell -c "Get-ChildItem -Path $env:USERPROFILE -Recurse -Filter '${task.filename}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName | ForEach-Object { Start-Process $_ }"`,()=>{});
      return`Searching for and opening ${task.filename}.`;
    }

    case "chrome_profile":{
      if(fs.existsSync(CHROME_EXE)){
        cp.spawn(CHROME_EXE,[`--profile-directory=${task.profileDir}`],{detached:true,stdio:"ignore"}).unref();
        return`Opened Chrome with profile for ${task.hint}.`;
      }
      openApp("chrome");
      return`Opened Chrome.`;
    }

    case "whatsapp_contact":{
      // Open WhatsApp Web and search for the contact
      const waUrl=`https://web.whatsapp.com`;
      openUrl(waUrl,null);
      // After page loads, use keyboard to search
      await new Promise(r=>setTimeout(r,4000));
      // Ctrl+/ opens search in WhatsApp Web, or Ctrl+F
      const r1=await desktopControl("hotkey",{keys:["ctrl","alt","shift","f"]});
      console.log("[aiBridge] WA search hotkey:",r1?.message);
      await new Promise(r=>setTimeout(r,500));
      await desktopControl("type_text",{text:task.contact,interval:0.05});
      return`Opened WhatsApp and searching for ${task.contact}.`;
    }

    case "youtube_search":{
      const ytUrl=`https://www.youtube.com/results?search_query=${encodeURIComponent(task.query)}`;
      openUrl(ytUrl,null);
      // Wait for page then click first video
      await new Promise(r=>setTimeout(r,3500));
      const click=await desktopControl("youtube_click_first_video",{wait:0});
      console.log("[aiBridge] YT click:",click?.message);
      return`Searched YouTube for "${task.query}" and playing first result.`;
    }

    case "web_search":{
      const url=`https://www.google.com/search?q=${encodeURIComponent(task.query)}`;
      openUrl(url,null);
      return`Searching the web for "${task.query}".`;
    }

    case "create_file":{
      const ft=(task.fileType||"").toLowerCase();
      const isExcel=ft.includes("excel")||ft.includes("xlsx")||ft.includes("spreadsheet");
      const isWord=ft.includes("word")||ft.includes("doc");
      const isHtml=ft.includes("html");
      const isPy=ft.includes("python")||ft.includes("py");
      // Build filename
      let baseName=task.name||"NewFile";
      let ext=isExcel?".xlsx":isWord?".docx":isHtml?".html":isPy?".py":ft.includes("txt")||ft.includes("text")?".txt":".txt";
      if(baseName.includes(".")) ext=""; // already has extension
      const fullName=baseName+ext;
      const deskPath=path.join(os.homedir(),"Desktop",fullName);

      if(isExcel){
        runPy(`import sys\ntry:\n    import openpyxl\n    wb=openpyxl.Workbook()\n    ws=wb.active\n    ws.title="Sheet1"\n    wb.save(r'${deskPath.replace(/\\/g,"\\\\")}')\n    print('Created ${fullName} on Desktop')\nexcept ImportError:\n    import subprocess\n    subprocess.run(['pip','install','openpyxl'],capture_output=True)\n    import openpyxl\n    wb=openpyxl.Workbook()\n    wb.save(r'${deskPath.replace(/\\/g,"\\\\")}')\n    print('Created ${fullName}')\n`);
      } else if(isWord){
        runPy(`try:\n    from docx import Document\n    d=Document()\n    d.save(r'${deskPath.replace(/\\/g,"\\\\")}')\nexcept:\n    open(r'${deskPath.replace(/\\/g,"\\\\")}','w').close()\nprint('Created ${fullName}')\n`);
      } else if(isHtml){
        fs.writeFileSync(deskPath,`<!DOCTYPE html>\n<html><head><title>${baseName}</title></head>\n<body><h1>${baseName}</h1></body></html>`);
      } else {
        fs.writeFileSync(deskPath,"");
      }
      return`Created ${fullName} on your Desktop.`;
    }

    case "system":{
      const volActs={
        vol_set:async()=>desktopControl("set_volume",{value:task.value||50}),
        vol_up:async()=>{const c=await desktopControl("get_volume");return desktopControl("set_volume",{value:Math.min(100,(c.actual||50)+10)});},
        vol_down:async()=>{const c=await desktopControl("get_volume");return desktopControl("set_volume",{value:Math.max(0,(c.actual||50)-10)});},
        minimize:async()=>desktopControl("minimize_all"),
        restore:async()=>desktopControl("restore_all"),
        mute:async()=>desktopControl("mute"),
      };
      const replies={
        vol_set:`Volume set to ${task.value||50}%.`,vol_up:"Volume increased.",vol_down:"Volume decreased.",
        minimize:"Minimizing all windows.",restore:"Restoring windows.",mute:"Toggled mute.",
      };
      if(volActs[task.action]){
        const r=await volActs[task.action]();
        if(r?.message&&r.ok) return r.message;
      }
      return replies[task.action]||"Done.";
    }

    case "close_app":{
      const pn=task.target.replace(/\.exe$/i,"");
      cp.exec(`powershell -c "Stop-Process -Name '${pn.replace(/'/g,"''")}' -Force -ErrorAction SilentlyContinue"`);
      return`Closed ${task.target}.`;
    }

    default: return null;
  }
}

// ─── Main entry: executeSystemAction ─────────────────────────────────────────
// ONLY called with raw USER input, never with LLM response text.
async function executeSystemAction(userQuery) {
  const tasks=parseTasks(userQuery);
  if(!tasks||tasks.length===0) return{handled:false,reply:""};
  const replies=[];
  for(const task of tasks){
    if(replies.length>0) await new Promise(r=>setTimeout(r,900));
    const r=await executeTask(task);
    if(r) replies.push(r);
  }
  if(replies.length===0) return{handled:false,reply:""};
  return{handled:true,reply:replies.join(" ")};
}

// ─── Stream Agent ─────────────────────────────────────────────────────────────
async function* streamAgent(params) {
  const {audioBuffer,textInput,userContext,sessionId="vos-default",voiceId="jarvis",signal}=params;

  let query=(textInput||"").trim();
  if(!query&&audioBuffer&&audioBuffer.length>0){
    query=await transcribePcm(audioBuffer);
    if(!query){yield{status:6,message:"No speech recognized. Please try again.",sessionId};return;}
  }
  if(!query){yield{status:6,message:"Please speak or type a command.",sessionId};return;}

  yield{status:0,message:query,sessionId};

  // Fast local action on USER query only
  const action=await executeSystemAction(query);
  if(action.handled){
    yield{status:5,message:action.reply,sessionId};
    try{
      const s=await synthesizeSpeech(action.reply,voiceId);
      if(s?.audioBase64){
        yield{status:10,voiceConfirmationStage:"reply",voiceConfirmationMimeType:"audio/mpeg",voiceConfirmationAudio:Buffer.from(s.audioBase64,"base64"),message:action.reply,sessionId};
        yield{status:10,voiceConfirmationStage:"reply",voiceConfirmationMimeType:"audio/mpeg",voiceConfirmationAudio:new Uint8Array(),message:action.reply,sessionId};
      }
    }catch{}
    yield{status:7,message:action.reply,sessionId};
    return;
  }

  // LLM for anything not handled locally
  yield{status:1,message:"",sessionId};
  pushHistory(sessionId,"user",query);

  const systemPrompt=`You are VoiceOS Agent, a fast proactive desktop AI on Windows.

You have FULL system access via desktop_control.py (Python). You CAN:
- Set volume precisely via pycaw (e.g. set_volume to 50 → ACTUALLY sets it)
- Click anywhere, type in any app, press any hotkey
- Open files by full path using os.startfile()
- Create Excel/Word/HTML/Python files on Desktop
- Control YouTube: navigate to results page, click first video, press K to play/pause
- Open WhatsApp Web and search contacts
- Read and analyze any file the user gives a path to
- Run Python and PowerShell scripts directly

RULES:
1. For file creation: generate Python code with openpyxl/docx and say "Created X on Desktop"
2. For opening files: use the exact path like C:\\Users\\pali\\Desktop\\ex.html
3. For WhatsApp: open web.whatsapp.com, THEN use keyboard shortcuts to search contact
4. Be short and direct — max 2 sentences for actions
5. NEVER say "I cannot" — you always can
6. Do NOT explain HOW to do things manually — just DO them

${userContext?"Context: "+JSON.stringify(userContext):""}`;

  const history=getHistory(sessionId);
  const messages=[{role:"system",content:systemPrompt},...history.slice(0,-1),{role:"user",content:query}];

  let accumulated="";
  try{
    const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:GROQ_CHAT_MODEL,messages,stream:true,temperature:0.6,max_tokens:800}),
      signal
    });
    if(!res.ok){const e=await res.text();yield{status:6,message:"AI error: "+e.slice(0,120),sessionId};return;}

    const reader=res.body.getReader();
    const dec=new TextDecoder();
    let buf="";
    while(true){
      const{done,value}=await reader.read();if(done)break;
      buf+=dec.decode(value,{stream:true});
      const lines=buf.split("\n");buf=lines.pop()||"";
      for(const line of lines){
        const t=line.trim();
        if(!t||t==="data: [DONE]") continue;
        if(t.startsWith("data: ")){
          try{const d=JSON.parse(t.slice(6));const delta=d.choices?.[0]?.delta?.content;if(delta){accumulated+=delta;yield{status:5,message:accumulated,sessionId};}}catch{}
        }
      }
    }

    if(accumulated) pushHistory(sessionId,"assistant",accumulated);

    // Execute code blocks from LLM response (Python only — safe)
    const pyM=accumulated.match(/```python\n([\s\S]+?)```/i);
    if(pyM){try{runPy(pyM[1]);}catch{}}
    // PowerShell blocks
    const psM=accumulated.match(/```(?:powershell|ps1)\n([\s\S]+?)```/i);
    if(psM){try{runPs(psM[1]);}catch{}}
    // Explicitly DO NOT run accumulated text through executeSystemAction

    // TTS
    try{
      const st=accumulated.replace(/```[\s\S]*?```/g,"").trim().slice(0,400);
      if(st){
        const s=await synthesizeSpeech(st,voiceId);
        if(s?.audioBase64){
          yield{status:10,voiceConfirmationStage:"reply",voiceConfirmationMimeType:"audio/mpeg",voiceConfirmationAudio:Buffer.from(s.audioBase64,"base64"),message:accumulated,sessionId};
          yield{status:10,voiceConfirmationStage:"reply",voiceConfirmationMimeType:"audio/mpeg",voiceConfirmationAudio:new Uint8Array(),message:accumulated,sessionId};
        }
      }
    }catch{}

    yield{status:7,message:accumulated,sessionId};

  }catch(err){
    if(signal?.aborted) return;
    yield{status:6,message:"Error: "+(err.message||String(err)),sessionId};
  }
}

module.exports={transcribePcm,transcribeStream,synthesizeSpeech,streamAgent,executeSystemAction,VOICE_MAP};
