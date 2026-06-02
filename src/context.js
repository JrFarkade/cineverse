import React, { useContext, useState, useEffect } from "react";
import useFetch from "./useFetch";
import { auth, db, storage } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  deleteDoc, 
  updateDoc, 
  addDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const AppContext = React.createContext();

export const AppProvider = ({ children }) => {
  const [queryVal, setQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [activitiesList, setActivitiesList] = useState([]);
  const [allWatchlists, setAllWatchlists] = useState([]);

  // Discovery Hub Caching States
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingTV, setTrendingTV] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [airingAnime, setAiringAnime] = useState([]);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

  // Dynamic TMDB Search Toggle
  const endpoint = queryVal.trim() ? `search/multi?query=${queryVal}` : "movie/popular";
  const { isLoading, isError, movie } = useFetch(endpoint);

  // Load and listen to Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoadingAuth(true);
      if (user) {
        setCurrentUser(user);
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          setUserProfile(profileData);
          await updateDoc(docRef, { lastLoginAt: new Date().toISOString() });
        } else {
          // If the profile document is missing (e.g. created outside or first time Google login)
          const baseUsername = user.displayName ? user.displayName.replace(/\s+/g, "") : user.email.split("@")[0];
          // Check uniqueness
          let uniqueUsername = baseUsername;
          let count = 1;
          let isUnique = false;
          while (!isUnique) {
            const q = query(collection(db, "users"), where("username", "==", uniqueUsername));
            const snap = await getDocs(q);
            if (snap.empty) {
              isUnique = true;
            } else {
              uniqueUsername = `${baseUsername}${count}`;
              count++;
            }
          }

          const profile = {
            uid: user.uid,
            username: uniqueUsername,
            email: user.email || "",
            avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uniqueUsername}`,
            createdAt: new Date().toISOString().split("T")[0],
            role: "user",
            isSuspended: false,
            lastLoginAt: new Date().toISOString()
          };
          await setDoc(docRef, profile);
          setUserProfile(profile);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setWatchlist([]);
      }
      setIsLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // Real-time Database Listeners (onSnapshot)
  useEffect(() => {
    if (!currentUser) {
      setWatchlist([]);
      return;
    }
    const q = query(collection(db, "watchlists"), where("userId", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => list.push(doc.data()));
      setWatchlist(list);
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setReviews(list);
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = collection(db, "users");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => list.push(doc.data()));
      setUsersList(list);
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setActivitiesList(list);
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || userProfile?.role !== "admin") {
      setAllWatchlists([]);
      return;
    }
    const q = collection(db, "watchlists");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => list.push(doc.data()));
      setAllWatchlists(list);
    });
    return unsubscribe;
  }, [currentUser, userProfile]);

  // Social Activities Helper
  const addSocialActivity = async (userId, description) => {
    try {
      const activity = {
        userId,
        username: userProfile?.username || "User",
        avatar: userProfile?.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=User",
        description,
        timestamp: new Date().toISOString()
      };
      await addDoc(collection(db, "activities"), activity);
    } catch (err) {
      console.error("Activity logging failed:", err);
    }
  };

  // Auth Operations
  const registerUser = async (email, password, username) => {
    // 1. Verify username uniqueness
    const q = query(collection(db, "users"), where("username", "==", username));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error("Username already exists. Please choose another username.");
    }

    // 2. Register user in Firebase Auth
    const credentials = await createUserWithEmailAndPassword(auth, email, password);
    const profile = {
      uid: credentials.user.uid,
      username,
      email,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
      createdAt: new Date().toISOString().split("T")[0],
      role: "user",
      isSuspended: false,
      lastLoginAt: new Date().toISOString()
    };
    await setDoc(doc(db, "users", credentials.user.uid), profile);
    setUserProfile(profile);
    return true;
  };

  const loginUser = async (emailOrUsername, password) => {
    let targetEmail = emailOrUsername;

    // Admin account intercept & seed on fresh projects
    if (emailOrUsername === "@Jrfarkade" && password === "@Sahil267") {
      targetEmail = "admin@cineverse.com";
      try {
        await signInWithEmailAndPassword(auth, targetEmail, password);
      } catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.message.includes("credential")) {
          // Admin doesn't exist yet, seed in Auth and Firestore
          const creds = await createUserWithEmailAndPassword(auth, targetEmail, password);
          const adminProfile = {
            uid: creds.user.uid,
            username: "@Jrfarkade",
            email: targetEmail,
            avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Jrfarkade",
            createdAt: new Date().toISOString().split("T")[0],
            role: "admin",
            isSuspended: false,
            lastLoginAt: new Date().toISOString()
          };
          await setDoc(doc(db, "users", creds.user.uid), adminProfile);
          setCurrentUser(creds.user);
          setUserProfile(adminProfile);
          return true;
        }
        throw err;
      }
      return true;
    }

    // Resolve Username to Email if they type username
    if (!emailOrUsername.includes("@")) {
      const q = query(collection(db, "users"), where("username", "==", emailOrUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        targetEmail = snap.docs[0].data().email;
      } else {
        throw new Error("Invalid username or password.");
      }
    }

    const credentials = await signInWithEmailAndPassword(auth, targetEmail, password);
    const user = credentials.user;
    
    // Check suspension status
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.isSuspended) {
        await signOut(auth);
        throw new Error("This account has been suspended by an administrator.");
      }
    }
    return true;
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const credentials = await signInWithPopup(auth, provider);
    const user = credentials.user;
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const baseUsername = user.displayName ? user.displayName.replace(/\s+/g, "") : user.email.split("@")[0];
      
      // Auto-resolve unique username
      let uniqueUsername = baseUsername;
      let count = 1;
      let isUnique = false;
      while (!isUnique) {
        const q = query(collection(db, "users"), where("username", "==", uniqueUsername));
        const snap = await getDocs(q);
        if (snap.empty) {
          isUnique = true;
        } else {
          uniqueUsername = `${baseUsername}${count}`;
          count++;
        }
      }

      const profile = {
        uid: user.uid,
        username: uniqueUsername,
        email: user.email || "",
        avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uniqueUsername}`,
        createdAt: new Date().toISOString().split("T")[0],
        role: "user",
        isSuspended: false,
        lastLoginAt: new Date().toISOString()
      };
      await setDoc(docRef, profile);
      setUserProfile(profile);
    } else {
      const data = docSnap.data();
      if (data.isSuspended) {
        await signOut(auth);
        throw new Error("This account has been suspended by an administrator.");
      }
      await updateDoc(docRef, { lastLoginAt: new Date().toISOString() });
    }
    return true;
  };

  const logoutUser = async () => {
    await signOut(auth);
  };

  // Upload Custom Avatar File to Firebase Storage
  const uploadAvatar = async (userId, file) => {
    const storageRef = ref(storage, `avatars/${userId}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  };

  const updateProfile = async (fields) => {
    if (!currentUser) return;
    const docRef = doc(db, "users", currentUser.uid);
    await updateDoc(docRef, fields);
    setUserProfile(prev => ({ ...prev, ...fields }));
  };

  // Watchlist Operations
  const addToWatchlist = async (media, status, personalRating = 0, episodesWatched = 0, totalEpisodes = 1, seasonsCompleted = 0, rewatchCount = 0) => {
    if (!currentUser) return;

    const isAnime = media.genres?.some(g => g.id === 16) && media.original_language === "ja";
    const isKdrama = !media.title && media.original_language === "ko";
    const concreteType = isAnime ? "anime" : (isKdrama ? "kdrama" : (media.title ? "movie" : "tv"));

    const item = {
      userId: currentUser.uid,
      mediaId: String(media.id),
      title: media.title || media.name,
      type: concreteType,
      originalType: media.title ? "movie" : "tv",
      posterPath: media.poster_path,
      status,
      personalRating: Number(personalRating),
      episodesWatched: Number(episodesWatched),
      totalEpisodes: Number(totalEpisodes),
      seasonsCompleted: Number(seasonsCompleted),
      rewatchCount: Number(rewatchCount),
      updatedAt: new Date().toISOString(),
      completionDate: status === "Completed" ? new Date().toISOString().split("T")[0] : ""
    };

    const docId = `${currentUser.uid}_${media.id}`;
    await setDoc(doc(db, "watchlists", docId), item);
    await addSocialActivity(currentUser.uid, `added **${item.title}** to **${status}**`);
  };

  const updateWatchlistProgress = async (mediaId, fields) => {
    if (!currentUser) return;

    const docId = `${currentUser.uid}_${mediaId}`;
    const docRef = doc(db, "watchlists", docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const currentItem = docSnap.data();
    const updatedFields = {
      ...fields,
      updatedAt: new Date().toISOString(),
      completionDate: fields.status === "Completed" ? new Date().toISOString().split("T")[0] : (currentItem.completionDate || "")
    };

    await updateDoc(docRef, updatedFields);

    if (fields.status && fields.status !== currentItem.status) {
      await addSocialActivity(currentUser.uid, `updated **${currentItem.title}** status to **${fields.status}**`);
    }
  };

  const removeFromWatchlist = async (mediaId) => {
    if (!currentUser) return;
    const docId = `${currentUser.uid}_${mediaId}`;
    await deleteDoc(doc(db, "watchlists", docId));
  };

  // Review Operations
  const addReview = async (mediaId, mediaTitle, content, rating) => {
    if (!currentUser || !userProfile) return;

    const review = {
      userId: currentUser.uid,
      username: userProfile.username,
      avatar: userProfile.avatar,
      mediaId: String(mediaId),
      mediaTitle,
      content,
      rating: Number(rating),
      likes: [],
      comments: [],
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, "reviews"), review);
    await addSocialActivity(currentUser.uid, `reviewed **${mediaTitle}** and rated it **${rating}/10**`);
  };

  const likeReview = async (reviewId) => {
    if (!currentUser) return;

    const docRef = doc(db, "reviews", reviewId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;
    const reviewData = docSnap.data();

    const likes = reviewData.likes || [];
    const isLiked = likes.includes(currentUser.uid);
    await updateDoc(docRef, {
      likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
  };

  const addCommentToReview = async (reviewId, commentText) => {
    if (!currentUser || !userProfile) return;

    const comment = {
      userId: currentUser.uid,
      username: userProfile.username,
      avatar: userProfile.avatar,
      text: commentText,
      createdAt: new Date().toISOString()
    };

    const docRef = doc(db, "reviews", reviewId);
    await updateDoc(docRef, {
      comments: arrayUnion(comment)
    });
  };

  // Admin Controls
  const deleteReview = async (reviewId) => {
    await deleteDoc(doc(db, "reviews", reviewId));
  };

  const getUserWatchlist = async (userId) => {
    const q = query(collection(db, "watchlists"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach((doc) => list.push(doc.data()));
    return list;
  };

  const updateUserStatus = async (userId, isSuspended) => {
    await updateDoc(doc(db, "users", userId), { isSuspended });
    setUsersList(prev => prev.map(u => u.uid === userId ? { ...u, isSuspended } : u));
    if (userProfile && userProfile.uid === userId) {
      setUserProfile(prev => ({ ...prev, isSuspended }));
    }
  };

  const deleteUser = async (userId) => {
    await deleteDoc(doc(db, "users", userId));
    const q = query(collection(db, "watchlists"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    snapshot.forEach(async (d) => {
      await deleteDoc(d.ref);
    });
    setUsersList(prev => prev.filter(u => u.uid !== userId));
  };

  const getSocialFeed = () => {
    return activitiesList;
  };

  return (
    <AppContext.Provider value={{ 
      query: queryVal, 
      movie, 
      setQuery, 
      isLoading, 
      isError,
      currentUser,
      userProfile,
      watchlist,
      reviews,
      usersList,
      allWatchlists,
      isLoadingAuth,
      registerUser,
      loginUser,
      logoutUser,
      loginWithGoogle,
      uploadAvatar,
      updateProfile,
      addToWatchlist,
      updateWatchlistProgress,
      removeFromWatchlist,
      addReview,
      likeReview,
      addCommentToReview,
      deleteReview,
      getUserWatchlist,
      updateUserStatus,
      deleteUser,
      getSocialFeed,
      trendingMovies,
      setTrendingMovies,
      trendingTV,
      setTrendingTV,
      upcoming,
      setUpcoming,
      airingAnime,
      setAiringAnime,
      dashboardLoaded,
      setDashboardLoaded
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useGlobalContext = () => {
  return useContext(AppContext);
};
