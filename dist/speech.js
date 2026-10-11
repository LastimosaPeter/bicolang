/*
 * Text-to-speech controls
 * -----------------------
 * This is an output/accessibility feature. It reads translations already shown
 * by app.js and does not perform translation or affect translation-speed tests.
 */
(()=>{
 const supported='speechSynthesis'in globalThis&&'SpeechSynthesisUtterance'in globalThis;
 const synth=supported?globalThis.speechSynthesis:null;
 const status=document.getElementById('speechStatus');
 const ids={Bicol:'bicol',Tagalog:'tagalog',English:'english'};
 const texts={Bicol:[],Tagalog:[],English:[]};
 let active=null,token=0,currentUtterance=null;

 // Selects the closest voice installed on the visitor's device. Native Bikol
 // voices are uncommon, so Filipino and English fallbacks are clearly labeled.
 function voiceFor(language){
  const voices=synth?.getVoices()||[];
  const find=prefixes=>{
   for(const prefix of prefixes){
    const match=voices.find(voice=>voice.lang.toLowerCase().replace(/_/g,'-').startsWith(prefix));
    if(match)return match;
   }
  };

  const native=find(
   language==='Bicol'?['bcl','bik']:
   language==='Tagalog'?['fil','tl']:
   ['en-ph','en-us','en-gb','en']
  );
  const fallback=native
   ||(language==='Bicol'?find(['fil','tl']):null)
   ||find(['en-ph','en-us','en'])
   ||voices.find(voice=>voice.default)
   ||voices[0];

  return{
   voice:fallback,
   lang:fallback?.lang||(language==='English'?'en-US':'fil-PH'),
   approximate:!native
  };
 }

 // Keeps button labels, disabled states, and voice notices synchronized.
 function refresh(){
  for(const[language,id]of Object.entries(ids)){
   const button=document.getElementById(id+'Listen');
   const hint=document.getElementById(id+'Voice');
   button.disabled=!supported||!texts[language].length;
   button.querySelector('span').textContent=active===language?'Stop':'Listen';
   button.setAttribute('aria-label',`${active===language?'Stop reading':'Listen to'} ${language} translations`);
   button.setAttribute('aria-pressed',String(active===language));

   if(!supported){
    hint.textContent='Speech unavailable in this browser';
    continue;
   }

   const choice=voiceFor(language);
   hint.textContent=language==='Bicol'&&choice.approximate
    ?'Bikol pronunciation is approximate'
    :choice.approximate&&language==='Tagalog'
     ?'Device voice fallback'
     :'';
   button.title=choice.voice?choice.voice.name:'Default device voice';
  }
 }

 // Cancels speech and invalidates callbacks belonging to the old request.
 function stop(){
  ++token;
  if(supported)synth.cancel();
  active=null;
  currentUtterance=null;
  status.hidden=true;
  refresh();
 }

 // Long results are split at sentence punctuation and spoken sequentially.
 function read(language){
  if(!supported||!texts[language].length)return;
  if(active===language){stop();return;}

  stop();
  active=language;
  const request=++token;
  const choice=voiceFor(language);
  const segments=texts[language].flatMap(text=>text.match(/[^.!?]+[.!?]?/g)||[text]);
  let next=0;

  status.hidden=false;
  status.textContent=`Reading ${language} translations…`;
  refresh();

  const speakNext=()=>{
   if(request!==token)return;
   if(next>=segments.length){
    active=null;
    currentUtterance=null;
    status.hidden=true;
    refresh();
    return;
   }

   const utterance=new SpeechSynthesisUtterance(segments[next++]);
   currentUtterance=utterance;
   utterance.lang=choice.lang;
   if(choice.voice)utterance.voice=choice.voice;
   utterance.rate=.9;
   utterance.pitch=1;
   utterance.volume=1;
   utterance.onend=speakNext;
   utterance.onerror=()=>{
    if(request!==token)return;
    active=null;
    currentUtterance=null;
    status.hidden=false;
    status.textContent='Speech could not play. Check your device voices and try Listen again.';
    refresh();
   };
   synth.speak(utterance);
   synth.resume();
  };
  speakNext();
 }

 // app.js supplies new displayed results through this small public interface.
 globalThis.BICOLANGSpeech={
  setText(language,values){texts[language]=values.filter(Boolean);refresh();},
  clear(){for(const language of Object.keys(texts))texts[language]=[];stop();},
  stop
 };

 for(const[language,id]of Object.entries(ids)){
  document.getElementById(id+'Listen').addEventListener('click',()=>read(language));
 }
 synth?.addEventListener('voiceschanged',refresh);
 globalThis.addEventListener('pagehide',stop);
 refresh();
})();
