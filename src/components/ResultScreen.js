import { useEffect, useRef } from "react";

function ResultScreen({ title, buttonText = "Back to Home", onBack }) {
  const isWin  = title.toLowerCase().includes("player wins") ||
                 title.toLowerCase().includes("player 1 wins") ||
                 title.toLowerCase().includes("player 2 wins") ||
                 title.toLowerCase().includes("you win");
  const isDraw = title.toLowerCase().includes("draw");

  const icon    = isWin ? "🏆" : isDraw ? "🤝" : "😈";
  const variant = isWin ? "result-win" : isDraw ? "result-draw" : "result-loss";

  /* simple particle burst on win */
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isWin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      r: Math.random() * 6 + 3,
      dx: (Math.random() - 0.5) * 4,
      dy: Math.random() * 3 + 1,
      color: ["#FFD700","#FF9900","#00FF88","#00CFFF","#FF6BFF"][Math.floor(Math.random() * 5)],
      alpha: 1,
    }));

    let frame;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.alpha -= 0.008;
        if (p.alpha < 0) p.alpha = 0;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (particles.some(p => p.alpha > 0)) frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [isWin]);

  return (
    <div className={`result-screen ${variant}`}>
      {isWin && <canvas ref={canvasRef} className="result-canvas" />}

      <div className="result-card">
        <div className="result-icon">{icon}</div>
        <h1 className="result-title">{title}</h1>
        <div className="result-divider" />
        <button className="result-btn" onClick={onBack}>
          {buttonText}
        </button>
      </div>
    </div>
  );
}

export default ResultScreen;