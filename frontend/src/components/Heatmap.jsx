export default function AttendanceHeatmap({ data = {} }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  if (entries.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontStyle: "italic", border: "1px dashed var(--border)", borderRadius: "var(--radius-md)" }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '10px' }}>
      {entries.map(([label, value]) => {
        const intensity = value / max;
        const isZero = value === 0;
        
        // Base color mixed with surface. 
        // We use a minimum of 20% intensity for non-zero values so they are visible.
        const mixPercentage = isZero ? 0 : Math.max(20, intensity * 100);
        const bgStyle = isZero 
          ? 'var(--surface-2)' 
          : `color-mix(in srgb, var(--primary) ${mixPercentage}%, var(--surface))`;
          
        const textColor = (!isZero && intensity > 0.5) 
          ? 'var(--primary-text)' 
          : 'var(--text-1)';

        return (
          <div
            key={label}
            style={{ 
              background: bgStyle,
              color: textColor,
              border: isZero ? '1px dashed var(--border)' : '1px solid transparent',
              borderRadius: 'var(--radius)',
              padding: '14px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title={`${label}: ${value} attendees`}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {label}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, lineHeight: 1 }}>
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
