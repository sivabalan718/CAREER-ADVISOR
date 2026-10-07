import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, animate, useInView } from 'framer-motion';
import { Loader2, ExternalLink, ShieldCheck, CircleDot, Link2, AlertTriangle } from 'lucide-react';
import { T, useI18n } from '../lib/i18n';

export const ease = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  show: (i = 0) => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease, delay: i * 0.06 } })
};

/** Card with mouse-follow glow and subtle 3D tilt. */
export function TiltCard({ children, className = '', style, onClick, intensity = 6, layoutId }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void; intensity?: number; layoutId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    rx.set((0.5 - py) * intensity);
    ry.set((px - 0.5) * intensity);
    ref.current!.style.setProperty('--mx', `${px * 100}%`);
    ref.current!.style.setProperty('--my', `${py * 100}%`);
  };
  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      className={`glass tile ${className}`}
      style={{ ...style, rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      onMouseMove={onMove}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.985 } : undefined}
    >
      <div className="glow" />
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, value, {
      duration: 1.4, ease,
      onUpdate: v => { if (ref.current) ref.current.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`; }
    });
    return () => c.stop();
  }, [value, inView, decimals, prefix, suffix]);
  return <span ref={ref}>{prefix}0{suffix}</span>;
}

export function ScoreRing({ value, size = 150, stroke = 10, label, sub, color }: { value: number | null; size?: number; stroke?: number; label?: string; sub?: string; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current;
  const v = value ?? 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color ?? '#8b5cf6'} />
            <stop offset="100%" stopColor={color ? color : '#22d3ee'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: value === null ? c : c * (1 - v / 100) }}
          transition={{ duration: 1.6, ease }}
        />
      </svg>
      <div className="center" style={{ position: 'absolute', inset: 0, textAlign: 'center' }}>
        <div>
          <div className="display" style={{ fontSize: size * 0.26 }}>{value === null ? '—' : <AnimatedNumber value={v} decimals={0} />}</div>
          {label && <div className="eyebrow" style={{ fontSize: 9.5, marginTop: 4 }}><T>{label}</T></div>}
          {sub && <div className="dim" style={{ fontSize: 11 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export function Meter({ label, value, color = 'var(--violet)', hint, weight }: { label: string; value: number | null; color?: string; hint?: string; weight?: number }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row between">
        <span style={{ fontSize: 13 }}><T>{label}</T>{weight !== undefined && <span className="dim mono" style={{ fontSize: 11 }}> · w {(weight * 100).toFixed(0)}%</span>}</span>
        <span className="mono" style={{ fontSize: 13, color: value === null ? 'var(--dim)' : undefined }}>{value === null ? 'no evidence' : value.toFixed(0)}</span>
      </div>
      <div className="bar">
        <motion.span initial={{ width: 0 }} whileInView={{ width: `${value ?? 0}%` }} viewport={{ once: true }} transition={{ duration: 1.1, ease }}
          style={{ background: value === null ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.08) 0 6px, transparent 6px 12px)' : `linear-gradient(90deg, ${color}, #22d3ee)`, width: value === null ? '100%' : undefined }} />
      </div>
      {hint && <span className="dim" style={{ fontSize: 12 }}><T>{hint}</T></span>}
    </div>
  );
}

const STATUS_META: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  VERIFIED: { cls: 'verified', icon: <ShieldCheck size={12} />, label: 'Verified' },
  PARTIAL: { cls: 'partial', icon: <CircleDot size={12} />, label: 'Partial' },
  EXTERNAL: { cls: 'external', icon: <Link2 size={12} />, label: 'External reference' },
  INSUFFICIENT: { cls: 'insufficient', icon: <AlertTriangle size={12} />, label: 'Insufficient evidence' }
};

export function EvidenceTag({ status, href, title }: { status?: string; href?: string; title?: string }) {
  const effective = (status === 'INSUFFICIENT' || !status) && href ? 'SOURCE' : status ?? 'INSUFFICIENT';
  if (effective === 'SOURCE') {
    return <a href={href} target="_blank" rel="noreferrer"><span className="tag external" title={title}><Link2 size={12} /><T>Evidence source</T><ExternalLink size={11} /></span></a>;
  }
  const m = STATUS_META[effective] ?? STATUS_META.INSUFFICIENT;
  const body = <span className={`tag ${m.cls}`} title={title}>{m.icon}<T>{m.label}</T>{href && <ExternalLink size={11} />}</span>;
  return href ? <a href={href} target="_blank" rel="noreferrer">{body}</a> : body;
}

export function SourceLink({ href, children }: { href?: string; children: string }) {
  if (!href) return <span className="dim">{children}</span>;
  return <a className="link" href={href} target="_blank" rel="noreferrer">{children} <ExternalLink size={11} style={{ verticalAlign: -1 }} /></a>;
}

export function Spinner({ label }: { label?: string }) {
  return <div className="row muted" style={{ gap: 10 }}><Loader2 size={18} className="spin" />{label && <T>{label}</T>}</div>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="glass card-pad center" style={{ minHeight: 180, textAlign: 'center' }}>
      <div className="col" style={{ alignItems: 'center', maxWidth: 520 }}>
        <div className="display h3"><T>{title}</T></div>
        <div className="muted">{children}</div>
      </div>
    </div>
  );
}

/** Radar for 7D fit vs. a reference polygon. */
export function Radar({ axes, values: raw, compare, size = 300 }: { axes: string[]; values: Array<number | null>; compare?: number[]; size?: number }) {
  const values = raw.map(v => v ?? 0);
  const { t } = useI18n();
  const cx = size / 2, cy = size / 2, R = size / 2 - 58;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }}>
      <defs>
        <radialGradient id="radarFill"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.25" /></radialGradient>
      </defs>
      {[25, 50, 75, 100].map(l => <polygon key={l} points={poly(axes.map(() => l))} fill="none" stroke="rgba(255,255,255,0.07)" />)}
      {axes.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" />; })}
      {compare && <polygon points={poly(compare)} fill="rgba(251,146,60,0.12)" stroke="#fb923c" strokeDasharray="4 4" />}
      <motion.polygon initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease }}
        style={{ transformOrigin: `${cx}px ${cy}px` }} points={poly(values)} fill="url(#radarFill)" stroke="#a78bfa" strokeWidth={2} />
      {values.map((v, i) => { if (raw[i] === null) return null; const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r={3.5} fill="#fff" />; })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 122);
        return <text key={a} x={x} y={y} fill={raw[i] === null ? '#4b5072' : '#9aa0c3'} fontSize="10.5" textAnchor="middle" dominantBaseline="middle">{t(a)}{raw[i] === null ? ` (${t('not measured')})` : ''}</text>;
      })}
    </svg>
  );
}

/** Minimal animated line/area chart. */
export function LineChart({ points, height = 160, format }: { points: Array<{ label: string; value: number }>; height?: number; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const w = 600, h = height, pad = 24;
  const min = Math.min(...points.map(p => p.value)), max = Math.max(...points.map(p => p.value));
  const span = max - min || 1;
  const xy = points.map((p, i) => [pad + (i * (w - pad * 2)) / (points.length - 1), h - pad - ((p.value - min) / span) * (h - pad * 2)]);
  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="lcFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient>
        <linearGradient id="lcStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#22d3ee" /></linearGradient>
      </defs>
      <motion.path d={`${d} L${xy[xy.length - 1][0]},${h - pad} L${xy[0][0]},${h - pad} Z`} fill="url(#lcFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} />
      <motion.path d={d} fill="none" stroke="url(#lcStroke)" strokeWidth={2.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease }} />
      {xy.map((p, i) => (
        <g key={i} onMouseEnter={() => setHover(i)}>
          <rect x={p[0] - (w / points.length) / 2} y={0} width={w / points.length} height={h} fill="transparent" />
          <circle cx={p[0]} cy={p[1]} r={hover === i ? 5 : 2.5} fill="#fff" />
        </g>
      ))}
      {hover !== null && (
        <g>
          <line x1={xy[hover][0]} x2={xy[hover][0]} y1={pad / 2} y2={h - pad} stroke="rgba(255,255,255,.2)" />
          <text x={Math.min(w - 120, xy[hover][0] + 8)} y={18} fill="#fff" fontSize="12">{points[hover].label}: {format ? format(points[hover].value) : points[hover].value}</text>
        </g>
      )}
      <text x={pad} y={h - 4} fill="#646a8c" fontSize="10">{points[0].label}</text>
      <text x={w - pad} y={h - 4} fill="#646a8c" fontSize="10" textAnchor="end">{points[points.length - 1].label}</text>
    </svg>
  );
}

export function Bars({ items, format }: { items: Array<{ label: string; value: number }>; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="col" style={{ gap: 10 }}>
      {items.map((it, i) => (
        <div key={it.label} className="col" style={{ gap: 4 }}>
          <div className="row between" style={{ fontSize: 13 }}><span>{it.label}</span><span className="mono muted">{format ? format(it.value) : it.value}</span></div>
          <div className="bar"><motion.span initial={{ width: 0 }} whileInView={{ width: `${(it.value / max) * 100}%` }} viewport={{ once: true }}
            transition={{ duration: 0.9, delay: i * 0.05, ease }} style={{ background: 'linear-gradient(90deg,#6366f1,#22d3ee)' }} /></div>
        </div>
      ))}
    </div>
  );
}

export const inr = (v: number | null | undefined, currency = 'INR') => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (currency !== 'INR') return `${currency} ${Math.round(v).toLocaleString()}`;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="col" style={{ gap: 8, marginBottom: 18 }}>
      {eyebrow && <span className="eyebrow"><T>{eyebrow}</T></span>}
      <h2 className="display h3"><T>{title}</T></h2>
      {children && <div className="muted" style={{ maxWidth: 760 }}>{children}</div>}
    </div>
  );
}

export function useParallax(range = 40) {
  const y = useMotionValue(0);
  const ty = useTransform(y, v => v * range);
  return { y, ty };
}
