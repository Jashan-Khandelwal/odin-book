import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import RequireAuth from "./components/RequireAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Feed from "./pages/Feed";
import Users from "./pages/Users";
import Requests from "./pages/Requests";
import Profile from "./pages/Profile";
import PostDetail from "./pages/PostDetail";
import Connections from "./pages/Connections";
import { NotificationProvider } from "./context/NotificationContext";
import Notifications from "./pages/Notifications";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Two nested layout routes: RequireAuth gates, Layout decorates.
              Every page below gets both, and neither is repeated per page. */}
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Feed />} />
                <Route path="/users" element={<Users />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/u/:username" element={<Profile />} />
                <Route path="/p/:postId" element={<PostDetail />} />
                <Route
                  path="/u/:username/followers"
                  element={<Connections direction="followers" />}
                />
                <Route
                  path="/u/:username/following"
                  element={<Connections direction="following" />}
                />
                <Route path="/notifications" element={<Notifications />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
