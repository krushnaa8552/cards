import trianglePattern from "../../../assets/diagonal-lines.svg";

const RoomBackground = () => (
  <div className="room__bg">
    <div className="room__bg-table">
      <div
        className="room__bg-pattern"
        style={{ backgroundImage: `url(${trianglePattern})` }}
      />
    </div>
  </div>
);

export default RoomBackground;