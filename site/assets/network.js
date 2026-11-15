/* Timing and packet statistics shared by the two local terminal modes. */
(() => {
  'use strict';
  const random=(a,b)=>a+Math.random()*(b-a);
  function profile(host){
    host=host||'127.0.0.1';const address=host==='localhost'?'127.0.0.1':host==='debian'?'10.0.2.15':host;
    if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)||address.split('.').some(n=>Number(n)>255))return {error:'ping: '+host+': Temporary failure in name resolution'};
    const loopback=address.startsWith('127.'),lan=/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
    const base=loopback?random(.018,.045):lan?random(.4,1.7):random(18,58),ttl=loopback||lan?64:address==='8.8.8.8'?117:55;
    let previous=base;
    return {host,address,ttl,display:host===address?address:host+' ('+address+')',packet(){
      const jitter=(Math.random()+Math.random()+Math.random()-1.5)*(loopback?.025:lan?.5:3.4);
      previous=Math.max(loopback?.009:lan?.15:1,previous*.4+(base+jitter)*.6);
      const latency=previous+(!loopback&&Math.random()<.04?random(2,12):0);
      return {latency,lost:!loopback&&Math.random()<.025};
    }};
  }
  function reply(p,sequence,packet){return '64 bytes from '+p.display+': icmp_seq='+sequence+' ttl='+p.ttl+' time='+packet.latency.toFixed(3)+' ms';}
  function summary(p,sent,latencies,elapsed){
    const received=latencies.length,rows=['--- '+p.host+' ping statistics ---',sent+' packets transmitted, '+received+' received, '+((sent-received)/Math.max(1,sent)*100).toFixed((sent-received)*100%Math.max(1,sent)?1:0)+'% packet loss, time '+Math.round(elapsed)+'ms'];
    if(received){const avg=latencies.reduce((a,b)=>a+b,0)/received,mdev=Math.sqrt(latencies.reduce((s,n)=>s+Math.pow(n-avg,2),0)/received);rows.push('rtt min/avg/max/mdev = '+[Math.min(...latencies),avg,Math.max(...latencies),mdev].map(n=>n.toFixed(3)).join('/')+' ms');}
    return rows;
  }
  window.TerminalNetwork={profile,reply,summary};
})();
