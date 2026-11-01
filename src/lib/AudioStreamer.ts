export class AudioStreamer {
  private ctx?:AudioContext; private stream?:MediaStream; private src?:MediaStreamAudioSourceNode;
  private proc?:ScriptProcessorNode; private mute?:GainNode; private next=0;
  private playing=new Set<AudioBufferSourceNode>();
  constructor(private send:(b64:string)=>void){}
  async start(){
    this.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    this.ctx=new AudioContext();await this.ctx.resume();this.src=this.ctx.createMediaStreamSource(this.stream);
    this.proc=this.ctx.createScriptProcessor(4096,1,1);this.mute=this.ctx.createGain();this.mute.gain.value=0;
    this.proc.onaudioprocess=e=>{const pcm=this.downsample(e.inputBuffer.getChannelData(0),this.ctx!.sampleRate);if(pcm.length)this.send(this.b64(pcm));};
    this.src.connect(this.proc);this.proc.connect(this.mute);this.mute.connect(this.ctx.destination);
  }
  private downsample(a:Float32Array,rate:number){const ratio=rate/16000,n=Math.floor(a.length/ratio),out=new Int16Array(n);for(let i=0;i<n;i++){const s=Math.floor(i*ratio),e=Math.min(Math.floor((i+1)*ratio),a.length);let sum=0;for(let j=s;j<e;j++)sum+=a[j];const v=sum/Math.max(1,e-s);out[i]=v<0?Math.max(-32768,Math.round(v*32768)):Math.min(32767,Math.round(v*32767));}return out;}
  private b64(a:Int16Array){const b=new Uint8Array(a.buffer);let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,Math.min(i+8192,b.length)));return btoa(s);}
  play(b64:string){if(!this.ctx)return;const raw=atob(b64),pcm=new Int16Array(raw.length/2);for(let i=0;i<pcm.length;i++){let v=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);pcm[i]=v>=32768?v-65536:v;}const buf=this.ctx.createBuffer(1,pcm.length,24000),ch=buf.getChannelData(0);for(let i=0;i<pcm.length;i++)ch[i]=pcm[i]/32768;const node=this.ctx.createBufferSource();node.buffer=buf;node.connect(this.ctx.destination);const at=Math.max(this.ctx.currentTime+.02,this.next);node.start(at);this.next=at+buf.duration;this.playing.add(node);node.onended=()=>this.playing.delete(node);}
  interrupt(){this.playing.forEach(n=>{try{n.stop()}catch{}});this.playing.clear();this.next=this.ctx?.currentTime||0;}
  async stop(){this.interrupt();this.proc?.disconnect();this.src?.disconnect();this.mute?.disconnect();this.stream?.getTracks().forEach(t=>t.stop());if(this.ctx&&this.ctx.state!=='closed')await this.ctx.close();this.ctx=undefined;}
}
