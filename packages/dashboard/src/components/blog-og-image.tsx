function getTitleFontSize(title: string): number {
  if (title.length <= 50) {
    return 56;
  }
  if (title.length <= 90) {
    return 46;
  }
  return 38;
}

export function BlogOgImage({ title }: { title: string }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 96px',
        fontFamily: 'sans-serif',
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: '#94a3b8',
          letterSpacing: 1,
          marginBottom: 40,
        }}
      >
        MuiRouter
      </div>
      <div
        style={{
          fontSize: getTitleFontSize(title),
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: 'center',
          maxWidth: 1008,
        }}
      >
        {title}
      </div>
    </div>
  );
}
