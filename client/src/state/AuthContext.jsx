import { createContext, useContext, useEffect, useState } from "react";
import {
  createGroup,
  connectCouple,
  deleteGroup,
  deletePost,
  disconnectCouple,
  getGroups,
  getCoupleStatus,
  getFeed,
  getMe,
  joinGroup,
  leaveGroup,
  login,
  register,
  resendVerification,
  transferGroupOwnership,
  updateProfileImage,
  uploadPost,
  verifyEmail,
} from "../lib/api";

const AuthContext = createContext(null);
const STORAGE_KEY = "silent-connection-token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [couple, setCouple] = useState(null);
  const [groups, setGroups] = useState([]);
  const [feed, setFeed] = useState([]);
  const [feedMeta, setFeedMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    hasMore: false,
  });
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);

  useEffect(() => {
    if (!token) {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setCouple(null);
      setGroups([]);
      setFeed([]);
      setBootstrapping(false);
      return;
    }

    localStorage.setItem(STORAGE_KEY, token);

    const bootstrap = async () => {
      try {
        const [meData, coupleData] = await Promise.all([
          getMe(token),
          getCoupleStatus(token),
        ]);
        setUser(meData.user);
        setCouple(coupleData);
        if (coupleData.connected) {
          const groupsData = await getGroups(token);
          setGroups(groupsData.groups);
        } else {
          setGroups([]);
        }
      } catch (error) {
        console.error(error);
        setToken(null);
      } finally {
        setBootstrapping(false);
      }
    };

    bootstrap();
  }, [token]);

  const refreshSession = async () => {
    if (!token) {
      return;
    }

    const [meData, coupleData] = await Promise.all([
      getMe(token),
      getCoupleStatus(token),
    ]);
    setUser(meData.user);
    setCouple(coupleData);
    if (coupleData.connected) {
      const groupsData = await getGroups(token);
      setGroups(groupsData.groups);
    } else {
      setGroups([]);
    }
  };

  const refreshGroups = async () => {
    if (!token || !couple?.connected) {
      setGroups([]);
      return;
    }

    const data = await getGroups(token);
    setGroups(data.groups);
  };

  const loadFeed = async ({
    page = 1,
    append = false,
    feedType = "couple",
    groupId = "",
  } = {}) => {
    if (!token) {
      return;
    }

    setLoadingFeed(true);

    try {
      const data = await getFeed(token, {
        page,
        limit: feedMeta.limit,
        feedType,
        groupId,
      });
      setFeed((current) => (append ? [...current, ...data.posts] : data.posts));
      setFeedMeta({
        page: data.page,
        limit: data.limit,
        total: data.total,
        hasMore: data.hasMore,
      });
    } finally {
      setLoadingFeed(false);
    }
  };

  const finishAuth = async (action, payload) => {
    const data = await action(payload);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const finishEmailVerification = async (payload) => {
    const data = await verifyEmail(payload);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const value = {
    token,
    user,
    couple,
    groups,
    feed,
    feedMeta,
    bootstrapping,
    loadingFeed,
    signIn: (payload) => finishAuth(login, payload),
    signUp: (payload) => register(payload),
    signOut: () => setToken(null),
    resendEmailVerification: (email) => resendVerification(email),
    verifyEmailToken: finishEmailVerification,
    refreshSession,
    refreshGroups,
    loadFeed,
    updateMyProfileImage: async (formData) => {
      const data = await updateProfileImage(token, formData);
      setUser(data.user);
      return data;
    },
    connectToPartner: async (inviteCode) => {
      const data = await connectCouple(token, inviteCode);
      await refreshSession();
      return data;
    },
    disconnectFromPartner: async () => {
      const data = await disconnectCouple(token);
      await refreshSession();
      setFeed([]);
      setGroups([]);
      setFeedMeta({
        page: 1,
        limit: 10,
        total: 0,
        hasMore: false,
      });
      return data;
    },
    createPost: async (formData, options = {}) => {
      if (!couple?.connected) {
        throw new Error("Connect your partner before posting.");
      }

      const data = await uploadPost(token, formData);
      await loadFeed({
        page: 1,
        feedType: options.feedType || "couple",
        groupId: options.groupId || "",
      });
      return data;
    },
    removePost: async (postId) => {
      const data = await deletePost(token, postId);
      setFeed((current) => current.filter((post) => post.id !== postId));
      setFeedMeta((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
      }));
      return data;
    },
    createNewGroup: async (payload) => {
      const data = await createGroup(token, payload);
      await refreshGroups();
      return data;
    },
    joinNewGroup: async (inviteCode) => {
      const data = await joinGroup(token, inviteCode);
      await refreshGroups();
      return data;
    },
    leaveExistingGroup: async (groupId) => {
      const data = await leaveGroup(token, groupId);
      await refreshGroups();
      return data;
    },
    transferExistingGroupOwnership: async (groupId, targetCoupleId) => {
      const data = await transferGroupOwnership(token, groupId, targetCoupleId);
      await refreshGroups();
      return data;
    },
    deleteExistingGroup: async (groupId) => {
      const data = await deleteGroup(token, groupId);
      await refreshGroups();
      setFeed((current) => current.filter((post) => post.groupId !== groupId));
      return data;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
