'use strict';

const {escape: e, ext, icon} = require('./ui');

const modes = [
  {
    id: 'p2p', label: 'OpenP2P', active: 2,
    source: 'https://github.com/openp2p-cn/openp2p/blob/master/README-ZH.md',
    steps: [
      ['signal', '网关协调', '两端经网关交换建链所需的对端网络信息。红色虚线表示控制信令。', '加入方 ↔ 协调网关 ↔ 房主'],
      ['punch', 'NAT 打洞', '两端按连接策略尝试 UDP 或 TCP 打洞。路由器的 NAT 映射和防火墙规则影响能否建立直连。', '加入方 → NAT A ⇄ NAT B ← 房主'],
      ['direct', '直连隧道', '穿透成功后，加入方的 Minecraft 连到 MCT 的本地监听地址，游戏流量经直连隧道抵达房主开放的局域网端口。', '加入方 ↔ NAT A ↔ NAT B ↔ 房主'],
      ['shared', '共享节点转发', 'OpenP2P 上游也支持经其他节点转发。这里展示的是上游能力，MCT 的 Link 模式有自己的中继链路。', '加入方 ↔ 共享节点 ↔ 房主']
    ]
  },
  {
    id: 'link', label: 'MCILM-Link', active: 1,
    source: 'https://mct.loft.games/',
    steps: [
      ['allocate', '建立中继连接', 'MCT 的 Link 模式分配公共中继服务。房主和加入方分别建立到中继的连接。', '加入方 → 公共中继 ← 房主'],
      ['relay', '中继转发', '双方的游戏流量通过公共中继转发。当两端的网络条件不适合打洞时，可以选择这条路径。', '加入方 ↔ 公共中继 ↔ 房主']
    ]
  },
  {
    id: 'et', label: 'EasyTier', active: 2,
    source: 'https://easytier.cn/guide/introduction.html',
    steps: [
      ['join', '加入虚拟网络', 'MCT 用 Scaffolding 房间码组织成员，EasyTier 建立虚拟网络。图中演示通过公共节点接入的情况。', '加入方 ↔ 公共节点 ↔ 房主'],
      ['mesh', '对等直连', '能建立直连时，两端可通过虚拟 IP 直接互通。虚线表示仍在拓扑中的其他链路。', '加入方虚拟 IP ↔ 房主虚拟 IP'],
      ['forward', '对等节点转发', '在这个场景里，两端无法直接建立链路，流量由可达的对等节点转发。', '加入方虚拟 IP ↔ 对等节点 ↔ 房主虚拟 IP']
    ]
  }
];

function mctGraphic() {
  const initial = modes[0].steps[modes[0].active];
  return `<figure class="mct-preview" data-mct-preview data-mode="p2p" data-scene="direct">
    <figcaption class="mct-heading">
      <div><h2>联机拓扑</h2><span>原理演示</span></div>
      <div class="mct-modes" role="group" aria-label="联机方案" hidden>${modes.map(({id,label,source}, index) =>
        `<button type="button" data-mct-choice="${id}" data-source="${e(source)}" aria-pressed="${index===0}">${e(label)}</button>`).join('')}</div>
    </figcaption>
    <div class="mct-console">
      <div class="mct-viewport">
        <div class="mct-stage" aria-label="联机拓扑图">
          <div class="mct-fallback"><span>示意路径</span><p data-mct-path>${e(initial[3])}</p></div>
        </div>
        <div class="mct-viewtools" hidden>
          <span>拖动旋转</span><button type="button" data-mct-reset>重置视角</button>
        </div>
      </div>
      <div class="mct-inspector">
        <div class="mct-steps" hidden>${modes.map(({id,label,steps,active}, index) =>
          `<div role="group" aria-label="${e(label)} 连接场景" data-mct-steps="${id}"${index ? ' hidden' : ''}>${steps.map(([scene,title,summary,path], step) =>
            `<button type="button" data-mct-step="${scene}" data-summary="${e(summary)}" data-path="${e(path)}" aria-pressed="${step===active}"><span aria-hidden="true"></span>${e(title)}</button>`).join('')}</div>`).join('')}</div>
        <p class="mct-explain" data-mct-summary aria-live="polite">${e(initial[2])}</p>
        <a class="mct-source" data-mct-source href="${e(modes[0].source)}" target="_blank" rel="noopener">查阅原理 ${icon('arrow')}</a>
      </div>
    </div>
    <div class="mct-footer">
      <ul class="mct-legend" aria-label="图例" hidden>
        <li data-line="data">游戏流量</li><li data-line="control">建链信令</li><li data-line="punch" hidden>打洞探测</li><li data-line="idle" hidden>其他链路</li>
      </ul>
      <div class="mct-links">
        <details class="mct-photo"><summary>软件截图</summary><a href="https://mct.loft.games/assets/p2p.png" target="_blank" rel="noopener">查看原图 ↗</a></details>
        ${ext('https://mct.loft.games/', 'MCT 官网 '+icon('arrow'), 'mct-source')}
      </div>
    </div>
  </figure>`;
}

module.exports = {mctGraphic};
