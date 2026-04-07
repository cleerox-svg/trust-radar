import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  M, SEV, DeepCard, StatTile, BrandAvatar, SevChip, GradeBadge,
} from './MobileUIKit';

import { useBrands, useBrandStats } from '@/hooks/useBrands';
import { useObservatoryStats } from '@/hooks/useObservatory';
import { useAlertStats } from '@/hooks/useAlerts';
import { useAgents } from '@/hooks/useAgents';
import { useFeedStats } from '@/hooks/useFeeds';
import { useUnreadCount, useNotifications } from '@/hooks/useNotifications';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const BRAND_COLORS = [
  { color: M.RED,     dimColor: M.RED_DIM },
  { color: '#fb923c', dimColor: '#7c2d12' },
  { color: '#fbbf24', dimColor: '#78350f' },
];

export function MobileCommandCenter() {
  const navigate = useNavigate();

  const { data: brandStats }  = useBrandStats();
  const { data: obsStats }    = useObservatoryStats();
  const { data: alertStats }  = useAlertStats();
  const { data: agentData }   = useAgents();
  const { data: feedStats }   = useFeedStats();
  const { data: unreadData }  = useUnreadCount();
  const { data: brandsData }  = useBrands({ view: 'top', limit: 10 });
  const { data: notifData }   = useNotifications(true);

  const [intelFilter, setIntelFilter] = useState<string>('all');
  const [activeNav, setActiveNav] = useState<string>('home');

  const notifications = Array.isArray(notifData?.notifications)
    ? notifData!.notifications
    : [];

  const filteredIntel = (intelFilter === 'all'
    ? notifications
    : notifications.filter((n: any) => n.severity === intelFilter)
  ).slice(0, 5);

  const agents       = Array.isArray(agentData) ? agentData : [];
  const unreadCount  = typeof unreadData === 'number' ? unreadData : 0;
  const criticalCount = alertStats?.critical ?? 0;

  const topBrands = [...(brandsData ?? [])]
    .sort((a, b) => (b.threat_count ?? 0) - (a.threat_count ?? 0))
    .slice(0, 3);

  const lastScan = agents
    .filter((a) => a.last_run_at)
    .sort((a, b) => new Date(b.last_run_at!).getTime() - new Date(a.last_run_at!).getTime())[0]?.last_run_at;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ minHeight: '100vh', background: '#060A14', fontFamily: 'system-ui,-apple-system,sans-serif', color: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @keyframes mcc-ping { 75%,100%{transform:scale(2.2);opacity:0} }
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{display:none}
        button{outline:none;border:none;background:none}
      `}</style>

      <div style={{ position:'fixed', top:-120, left:-80, width:420, height:420, borderRadius:'50%', background:'rgba(10,37,64,0.40)', filter:'blur(120px)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:-140, right:-80, width:380, height:380, borderRadius:'50%', background:'rgba(229,168,50,0.06)', filter:'blur(140px)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', inset:0, opacity:0.02, backgroundImage:'linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)', backgroundSize:'60px 60px', pointerEvents:'none', zIndex:0 }} />

      <div style={{ position:'relative', zIndex:1, paddingBottom:110 }}>

        {/* HEADER */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'22px 20px 0' }}>
          <div>
            <div style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.22em', color:M.AMBER, marginBottom:5, textShadow:`0 0 12px ${M.AMBER}60` }}>
              AVERROW · COMMAND CENTER
            </div>
            <div style={{ fontSize:22, fontWeight:900, lineHeight:1.1, letterSpacing:-0.8 }}>
              {greeting},{' '}
              <span style={{ color:M.AMBER, textShadow:`0 0 20px ${M.AMBER}50` }}>Claude</span>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.30)', marginTop:5 }}>
              {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ position:'relative', width:8, height:8 }}>
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#4ade80', opacity:0.65, animation:'mcc-ping 1.6s ease-in-out infinite' }} />
                <div style={{ position:'relative', width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px rgba(34,197,94,0.8)' }} />
              </div>
              <span style={{ fontSize:8, fontFamily:'monospace', color:'rgba(255,255,255,0.30)', letterSpacing:'0.18em' }}>LIVE</span>
            </div>
            <div style={{ position:'relative', cursor:'pointer' }} onClick={() => navigate('/v2/notifications')}>
              <div style={{ width:36, height:36, borderRadius:11, background:'linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))', border:'1px solid rgba(255,255,255,0.14)', boxShadow:'0 4px 12px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.15),inset 0 -1px 0 rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>
                🔔
              </div>
              {unreadCount > 0 && (
                <div style={{ position:'absolute', top:-4, right:-4, minWidth:18, height:18, borderRadius:99, background:`linear-gradient(135deg,${M.RED},${M.RED_DIM})`, border:'2px solid #060A14', fontSize:9, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', padding:'0 4px', boxShadow:`0 2px 8px rgba(239,68,68,0.6)` }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </div>
            <div style={{ width:36, height:36, borderRadius:11, background:`linear-gradient(145deg,${M.RED},${M.RED_DIM})`, border:`1px solid ${M.RED}60`, boxShadow:`0 4px 14px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,120,120,0.35),inset 0 -1px 0 rgba(0,0,0,0.4),0 0 16px ${M.RED}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,0.6)' }}>
              CL
            </div>
          </div>
        </div>

        {/* CRITICAL BANNER */}
        {criticalCount > 0 && (
          <div style={{ padding:'14px 20px 0' }}>
            <DeepCard variant="critical" onClick={() => navigate('/v2/alerts')} style={{ padding:'11px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ position:'relative', width:8, height:8, flexShrink:0 }}>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#f87171', opacity:0.7, animation:'mcc-ping 1.8s ease-in-out infinite' }} />
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#f87171', boxShadow:'0 0 8px rgba(248,113,113,0.9)' }} />
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:'#fca5a5', flex:1 }}>
                  {criticalCount} critical alert{criticalCount !== 1 ? 's' : ''} require{criticalCount === 1 ? 's' : ''} attention
                </span>
                <span style={{ fontSize:12, color:M.AMBER, fontWeight:800, textShadow:`0 0 10px ${M.AMBER}80`, flexShrink:0 }}>View →</span>
              </div>
            </DeepCard>
          </div>
        )}

        {/* STATUS BAR */}
        <div style={{ padding:'10px 20px 0' }}>
          <DeepCard variant="base" style={{ padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ position:'relative', width:8, height:8 }}>
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#4ade80', opacity:0.6, animation:'mcc-ping 1.6s ease-in-out infinite' }} />
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px rgba(34,197,94,0.9)' }} />
              </div>
              <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.14em', color:'#4ade80', textShadow:'0 0 10px rgba(74,222,128,0.5)' }}>
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.30)', fontFamily:'monospace' }}>
              {lastScan ? `Scan: ${timeAgo(lastScan)}` : 'Scanning...'}
            </span>
          </DeepCard>
        </div>

        {/* STAT GRID */}
        <div style={{ padding:'14px 20px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <StatTile label="Brands"  value={brandStats?.total_tracked ?? 0}  sub={`${brandStats?.new_this_week ?? 0} new this week`} accent={M.AMBER} onClick={() => navigate('/v2/brands')} />
          <StatTile label="Threats" value={obsStats?.threats_mapped ?? 0}    sub={`${obsStats?.countries ?? 0} countries`}           accent={M.RED}   onClick={() => navigate('/v2/threats')} />
          <StatTile label="Alerts"  value={alertStats?.total ?? 0}           sub={`${criticalCount} critical`}                       accent={M.RED}   critical={criticalCount} onClick={() => navigate('/v2/alerts')} />
          <StatTile label="Agents"  value={agents.filter((a) => a.status === 'healthy' || a.status === 'running').length} sub={`of ${agents.length || 11} online`} accent={M.BLUE}  onClick={() => navigate('/v2/agents')} />
          <StatTile label="Feeds"   value={feedStats?.active ?? 0}           sub={`of ${feedStats?.total ?? 34} active`}             accent={M.GREEN} onClick={() => navigate('/v2/feeds')} />
          <StatTile label="Campaigns" value={0} sub="active ops" accent={M.BLUE} onClick={() => navigate('/v2/campaigns')} />
        </div>

        {/* BRANDS AT RISK */}
        {topBrands.length > 0 && (
          <div style={{ padding:'18px 20px 0' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:2, height:14, borderRadius:99, background:`linear-gradient(180deg,${M.AMBER},transparent)` }} />
                <span style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.20em', color:'rgba(255,255,255,0.45)', textTransform:'uppercase' }}>Brands at Risk</span>
              </div>
              <span onClick={() => navigate('/v2/brands')} style={{ fontSize:11, color:M.AMBER, cursor:'pointer', fontWeight:700, textShadow:`0 0 10px ${M.AMBER}60` }}>View all →</span>
            </div>
            <DeepCard variant="base" style={{ padding:0, overflow:'hidden' }}>
              {topBrands.map((brand, i) => {
                const c = BRAND_COLORS[i] ?? BRAND_COLORS[0];
                const tc = brand.threat_count ?? 0;
                const sevKey = tc > 30 ? 'critical' : tc > 15 ? 'high' : 'medium';
                return (
                  <div key={brand.id} onClick={() => navigate(`/v2/brands/${brand.id}`)} style={{ padding:'14px 16px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none', display:'flex', alignItems:'center', gap:12, cursor:'pointer', borderLeft:`2px solid ${c.color}60`, background: i === 0 ? `linear-gradient(90deg,${c.color}08,transparent 50%)` : 'transparent' }}>
                    <BrandAvatar name={brand.name} color={c.color} dimColor={c.dimColor} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.92)' }}>{brand.name}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.32)', marginTop:2, fontFamily:'monospace' }}>{brand.canonical_domain}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:16, fontWeight:900, fontFamily:'monospace', color:c.color, textShadow:`0 0 12px ${c.color}70` }}>{tc}</span>
                        <SevChip severity={sevKey} />
                      </div>
                      <GradeBadge grade={brand.bimi_grade ?? brand.email_security_grade} />
                    </div>
                  </div>
                );
              })}
            </DeepCard>
          </div>
        )}

        {/* ── LATEST INTELLIGENCE ── */}
        <div style={{ padding:'18px 20px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:2, height:14, borderRadius:99, background:`linear-gradient(180deg,${M.BLUE},transparent)` }} />
              <span style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.20em', color:'rgba(255,255,255,0.45)', textTransform:'uppercase' }}>Latest Intelligence</span>
            </div>
            <span style={{ fontSize:9, color:'rgba(255,255,255,0.22)', fontFamily:'monospace' }}>Powered by Observer</span>
          </div>

          {/* Filter pills */}
          <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto' }}>
            {['all','critical','high','medium','low'].map(f => {
              const active = intelFilter === f;
              const s = SEV[f];
              return (
                <button key={f} onClick={() => setIntelFilter(f)} style={{
                  flexShrink:0, padding:'5px 13px', borderRadius:99,
                  fontSize:9, fontFamily:'monospace', cursor:'pointer',
                  textTransform:'uppercase', letterSpacing:'0.12em',
                  border:`1px solid ${active ? (s?.border ?? 'rgba(229,168,50,0.35)') : 'rgba(255,255,255,0.08)'}`,
                  backgroundColor: active ? (s?.bg ?? 'rgba(229,168,50,0.12)') : 'rgba(255,255,255,0.03)',
                  color: active ? (s?.text ?? M.AMBER) : 'rgba(255,255,255,0.38)',
                  boxShadow: active ? `inset 0 1px 0 ${s?.dot ?? M.AMBER}30` : 'none',
                }}>
                  {f}
                </button>
              );
            })}
          </div>

          <DeepCard variant="base" style={{ padding:0, overflow:'hidden' }}>
            {filteredIntel.length === 0 ? (
              <div style={{ padding:'20px 16px', textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:12 }}>
                No {intelFilter !== 'all' ? intelFilter + ' ' : ''}alerts
              </div>
            ) : filteredIntel.map((item: any, i: number) => {
              const s = SEV[item.severity] ?? SEV.low;
              return (
                <div key={item.id} onClick={() => navigate('/v2/alerts')} style={{
                  padding:'13px 16px',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer',
                  borderLeft:`2px solid ${s.dot}70`,
                  background:`linear-gradient(90deg,${s.dot}08,transparent 40%)`,
                }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', marginTop:4, flexShrink:0, background:s.dot, boxShadow:`0 0 8px ${s.dot}80` }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.88)', lineHeight:1.4 }}>
                      {item.title}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5 }}>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.28)', fontFamily:'monospace' }}>
                        {timeAgo(item.created_at)}
                      </span>
                      {item.brand_name && (
                        <>
                          <span style={{ width:2, height:2, borderRadius:'50%', background:'rgba(255,255,255,0.18)' }} />
                          <span style={{ fontSize:10, color:'rgba(255,255,255,0.38)' }}>{item.brand_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize:18, color:'rgba(255,255,255,0.18)', flexShrink:0, paddingTop:1 }}>›</span>
                </div>
              );
            })}
          </DeepCard>
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div style={{ padding:'18px 20px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:2, height:14, borderRadius:99, background:`linear-gradient(180deg,${M.GREEN},transparent)` }} />
            <span style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.20em', color:'rgba(255,255,255,0.45)', textTransform:'uppercase' }}>Quick Actions</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:'Observatory',   desc:'Global threat map', emoji:'🌐', accent:M.BLUE,  path:'/v2/observatory' },
              { label:'Brands Hub',    desc:'Portfolio health',  emoji:'🛡', accent:M.AMBER, path:'/v2/brands' },
              { label:'Threat Actors', desc:'18 adversaries',    emoji:'🎯', accent:M.RED,   path:'/v2/threat-actors' },
              { label:'Geo Campaign',  desc:'IRGC active',       emoji:'⚡', accent:M.RED,   path:'/v2/campaigns' },
            ].map(a => (
              <DeepCard key={a.label} variant="stat" accentColor={a.accent} onClick={() => navigate(a.path)} style={{ padding:'16px 14px', cursor:'pointer' }}>
                <div style={{ fontSize:24, marginBottom:10, filter:`drop-shadow(0 0 8px ${a.accent}60)` }}>{a.emoji}</div>
                <div style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,0.90)' }}>{a.label}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.32)', marginTop:3 }}>{a.desc}</div>
              </DeepCard>
            ))}
          </div>
        </div>

      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'rgba(4,7,16,0.94)',
        backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        borderTop:'1px solid rgba(255,255,255,0.08)',
        boxShadow:'0 -8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.07)',
        padding:'10px 0 28px',
        display:'flex', justifyContent:'space-around', alignItems:'center', zIndex:100,
      }}>
        {[
          { icon:'🏠', label:'Home',   id:'home',   path:'/v2',             badge: 0 },
          { icon:'🌐', label:'Map',    id:'obs',    path:'/v2/observatory', badge: 0 },
          { icon:'🛡', label:'Brands', id:'brands', path:'/v2/brands',      badge: 0 },
          { icon:'🔔', label:'Alerts', id:'alerts', path:'/v2/alerts',      badge: unreadCount },
          { icon:'☰',  label:'More',   id:'more',   path:'/v2/agents',      badge: 0 },
        ].map(n => (
          <button key={n.id} onClick={() => { setActiveNav(n.id); navigate(n.path); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', position:'relative', padding:'6px 14px' }}>
            {(n.badge ?? 0) > 0 && (
              <div style={{ position:'absolute', top:2, right:8, minWidth:16, height:16, borderRadius:'50%', background:`linear-gradient(135deg,${M.RED},${M.RED_DIM})`, border:'2px solid rgba(4,7,16,0.9)', fontSize:8, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', boxShadow:`0 2px 8px ${M.RED}60` }}>
                {(n.badge ?? 0) > 99 ? '99+' : n.badge}
              </div>
            )}
            <span style={{ fontSize:22, filter: activeNav === n.id ? `drop-shadow(0 0 6px ${M.AMBER}80)` : 'none' }}>{n.icon}</span>
            <span style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.08em', color: activeNav === n.id ? M.AMBER : 'rgba(255,255,255,0.30)', textTransform:'uppercase', textShadow: activeNav === n.id ? `0 0 10px ${M.AMBER}60` : 'none' }}>{n.label}</span>
            {activeNav === n.id && (
              <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:24, height:2, borderRadius:99, background:`linear-gradient(90deg,transparent,${M.AMBER},transparent)`, boxShadow:`0 0 8px ${M.AMBER}` }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
