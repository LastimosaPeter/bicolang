(()=>{
 const supported='speechSynthesis'in globalThis&&'SpeechSynthesisUtterance'in globalThis;
 const synth=supported?globalThis.speechSynthesis:null;
 const status=document.getElementById('speechStatus');
 const ids={Bicol:'bicol',Tagalog:'tagalog',English:'english'};
 const texts={Bicol:[],Tagalog:[],English:[]};
 let active=null,token=0,currentUtterance=null,timing=null;
 function voiceFor(language){
  const voices=synth?.getVoices()||[];
  const find=prefixes=>{for(const prefix of prefixes){const match=voices.find(v=>v.lang.toLowerCase().replace(/_/g,'-').startsWith(prefix));if(match)return match;}};
  const native=find(language==='Bicol'?['bcl','bik']:language==='Tagalog'?['fil','tl']:['en-ph','en-us','en-gb','en']);
  const fallback=native||(language==='Bicol'?find(['fil','tl']):null)||find(['en-ph','en-us','en'])||voices.find(v=>v.default)||voices[0];
  return{voice:fallback,lang:fallback?.lang||(language==='English'?'en-US':'fil-PH'),approximate:!native};
 }
 function refresh(){
  for(const[language,id]of Object.entries(ids)){
   const button=document.getElementById(id+'Listen'),hint=document.getElementById(id+'Voice');
   button.disabled=!supported||!texts[language].length;
   button.querySelector('span').textContent=active===language?'Stop':'Listen';
   button.setAttribute('aria-label',`${active===language?'Stop reading':'Listen to'} ${language} translations`);
   button.setAttribute('aria-pressed',String(active===language));
   if(!supported){hint.textContent='Speech unavailable in this browser';continue;}
   const choice=voiceFor(language);
   hint.textContent=language==='Bicol'&&choice.approximate?'Bikol pronunciation is approximate':choice.approximate&&language==='Tagalog'?'Device voice fallback':'';
   button.title=choice.voice?choice.voice.name:'Default device voice';
  }
 }
 function stop(){if(timing){globalThis.BICOLANGMeasurements?.add({...timing,kind:'TTS',outcome:'cancelled',ms:timing.audioStart==null?null:timing.audioStart-timing.start,durationMs:timing.audioStart==null?null:performance.now()-timing.audioStart});timing=null;}++token;if(supported)synth.cancel();active=null;currentUtterance=null;status.hidden=true;refresh();}
 function read(language){
  if(!supported||!texts[language].length)return;
  if(active===language){stop();return;}
  stop();timing={language,query:texts[language].join(' · '),model:'Device speech synthesis',start:performance.now(),audioStart:null};active=language;const request=++token,choice=voiceFor(language);
  const segments=texts[language].flatMap(text=>text.match(/[^.!?]+[.!?]?/g)||[text]);let next=0;
  status.hidden=false;status.textContent=`Reading ${language} translations…`;refresh();
  const speakNext=()=>{
   if(request!==token)return;
   if(next>=segments.length){if(timing){globalThis.BICOLANGMeasurements?.add({...timing,kind:'TTS',outcome:'completed',ms:timing.audioStart==null?null:timing.audioStart-timing.start,durationMs:timing.audioStart==null?null:performance.now()-timing.audioStart});timing=null;}active=null;currentUtterance=null;status.hidden=true;refresh();return;}
   const utterance=new SpeechSynthesisUtterance(segments[next++]);currentUtterance=utterance;
   utterance.lang=choice.lang;if(choice.voice)utterance.voice=choice.voice;utterance.rate=.9;utterance.pitch=1;utterance.volume=1;
   utterance.onstart=()=>{if(request===token&&timing&&timing.audioStart==null)timing.audioStart=performance.now();};utterance.onend=speakNext;
   utterance.onerror=e=>{if(request!==token)return;if(timing){globalThis.BICOLANGMeasurements?.add({...timing,kind:'TTS',outcome:'error',ms:null});timing=null;}active=null;currentUtterance=null;status.hidden=false;status.textContent='Speech could not play. Check your device voices and try Listen again.';refresh();};
   synth.speak(utterance);synth.resume();
  };
  speakNext();
 }
 globalThis.BICOLANGSpeech={setText(language,values){texts[language]=values.filter(Boolean);refresh();},clear(){for(const lang of Object.keys(texts))texts[lang]=[];stop();},stop};
 for(const[language,id]of Object.entries(ids))document.getElementById(id+'Listen').addEventListener('click',()=>read(language));
 synth?.addEventListener('voiceschanged',refresh);
 globalThis.addEventListener('pagehide',stop);
 refresh();
})();
