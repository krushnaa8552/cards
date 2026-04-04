const ToastContainer = ({ toasts }) => (
  <div className="toasts">
    {toasts.map((m, i) => (
      <div key={i} className={`toast toast--${m.type}`}>{m.text}</div>
    ))}
  </div>
);

export default ToastContainer;