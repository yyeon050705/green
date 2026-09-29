import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="home-page">
      <h1>게시판</h1>
      <p>{user?.username}님, 환영합니다.</p>
      <button onClick={logout}>로그아웃</button>
    </div>
  );
}
