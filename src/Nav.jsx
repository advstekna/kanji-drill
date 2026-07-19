export default function Nav({ tab, setTab }) {
  const tabs = [
    { key: 'drill',    label: 'Drill',    icon: '⚡' },
    { key: 'progress', label: 'Progress', icon: '🗾' },
    { key: 'stats',    label: 'Stats',    icon: '📊' },
  ]

  return (
    <nav style={s.nav}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{ ...s.tab, ...(tab === t.key ? s.active : {}) }}
        >
          <span style={s.icon}>{t.icon}</span>
          <span style={s.label}>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

const s = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    display: 'flex', borderTop: '1px solid #f3f4f6',
    background: '#fff',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 100,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '10px 0', gap: 3,
    background: 'none', border: 'none', cursor: 'pointer',
  },
  active: {},
  icon: { fontSize: 20, lineHeight: 1 },
  label: { fontSize: 10, fontWeight: 600, color: '#bbb', letterSpacing: '0.06em', textTransform: 'uppercase' },
}