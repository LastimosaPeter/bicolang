(()=>{
 const button=document.getElementById('microphone'),status=document.getElementById('recognitionStatus'),language=document.getElementById('recognitionLanguage'),query=document.getElementById('query');if(!button)return;
 const API=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;let active=null,sequence=0;
 function state(label,pressed=false){button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(pressed));}
 if(!API){button.disabled=true;state('Speech input unavailable');status.textContent='Speech recognition is unavailable in this browser. You can still type to search.';return;}
 function cancel(){++sequence;if(active){active.abort();active=null;}state('Start speech input');language.disabled=false;}
 button.addEventListener('click',()=>{
  if(active){active.stop();state('Processing speech input',true);status.textContent='Processing speech input…';return;}
  globalThis.BICOLANGSpeech?.stop();const recognition=new API(),token=++sequence,started=performance.now();let ended=null,recorded=false;active=recognition;
  recognition.lang=language.value;recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
  state('Stop speech input',true);language.disabled=true;status.textContent='Listening… Speak a word or dictionary phrase.';
  const log=(outcome,transcript='')=>{if(recorded)return;recorded=true;const now=performance.now();globalThis.BICOLANGMeasurements?.add({kind:'STT',outcome,query:transcript,language:recognition.lang,model:'Browser speech recognition',ms:now-started,postSpeechMs:ended==null?null:now-ended});};
  recognition.onspeechend=()=>{ended=performance.now();};
  recognition.onresult=e=>{if(token!==sequence)return;const transcript=e.results[0][0].transcript;log('completed',transcript);query.value=transcript.slice(0,query.maxLength>0?query.maxLength:160);status.textContent='Recognized: '+transcript+' · Review the text; searching the dictionary.';query.dispatchEvent(new Event('input',{bubbles:true}));};
  recognition.onerror=e=>{if(token!==sequence)return;log('error:'+e.error);status.textContent=e.error==='not-allowed'?'Microphone access was denied. Allow it in browser settings to use speech input.':e.error==='language-not-supported'?'This recognition language is not supported. Choose Filipino or English.':'Speech input failed ('+e.error+'). Try again or type your text.';};
  recognition.onend=()=>{if(token!==sequence)return;if(!recorded){log('no result');status.textContent='No final text was recognized. Try again or type your text.';}active=null;state('Start speech input');language.disabled=false;};
  try{recognition.start();}catch(e){log('error');cancel();status.textContent='Speech input could not start. Check browser support and microphone access.';}
 });
 language.addEventListener('change',cancel);query.addEventListener('input',()=>{if(active){cancel();}});document.getElementById('clear').addEventListener('click',cancel);globalThis.addEventListener('pagehide',cancel);
})();
