export default function Soon({ params }) {
  return (
    <>
      <h1 style={{ textTransform: "capitalize" }}>{params.section}</h1>
      <p className="sub">This page is built in an upcoming round.</p>
    </>
  );
}
