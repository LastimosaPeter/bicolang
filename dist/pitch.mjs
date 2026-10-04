// Experimental local autocorrelation estimator, 70–500 Hz. Not a linguistic classifier.
export function estimatePitch(samples,sampleRate){
 let mean=0;for(const x of samples)mean+=x;mean/=samples.length;let energy=0;const x=Float32Array.from(samples,v=>{const y=v-mean;energy+=y*y;return y;});if(Math.sqrt(energy/x.length)<.01)return null;
 const min=Math.ceil(sampleRate/500),max=Math.min(Math.floor(sampleRate/70),Math.floor(x.length/2));let best=-1,lag=0;const correlations=[];
 for(let d=min;d<=max;d++){let cross=0,a=0,b=0;for(let i=0;i<x.length-max;i++){cross+=x[i]*x[i+d];a+=x[i]*x[i];b+=x[i+d]*x[i+d];}const c=cross/Math.sqrt(a*b||1);correlations[d]=c;if(c>best){best=c;lag=d;}}
 if(best<.75)return null;
 // Prefer the first strong local maximum to reduce octave/subharmonic errors.
 for(let d=min+1;d<max;d++)if(correlations[d]>=Math.max(.75,best-.05)&&correlations[d]>=correlations[d-1]&&correlations[d]>=correlations[d+1]){lag=d;break;}
 return sampleRate/lag;
}
export function classifyContour(values){const median=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};const pitches=values.filter(x=>Number.isFinite(x)&&x>=70&&x<=500);if(pitches.length<12)return {detected:'unscorable',voicedFrames:pitches.length,semitones:null};const count=Math.max(4,Math.floor(pitches.length/3)),first=median(pitches.slice(0,count)),last=median(pitches.slice(-count)),semitones=12*Math.log2(last/first);return{detected:semitones>2?'rising':semitones< -2?'falling':'level',semitones,voicedFrames:pitches.length};}
