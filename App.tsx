import React, { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, setDoc, doc, getDoc, where, updateDoc, arrayUnion, arrayRemove, getDocs, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { UserProfile, Post, FeedType } from './types';
import PostCard from './components/PostCard';
import CreatePostModal from './components/CreatePostModal';
import UserProfilePage from './components/UserProfilePage';
import MapView from './components/MapView';

const POSTS_PER_PAGE = 5;

interface RankedBook {
  title: string;
  author: string;
  coverImage: string;
  totalLikes: number;
}

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [feedType, setFeedType] = useState<FeedType>(FeedType.GLOBAL);
  const [posts, setPosts] = useState<Post[]>([]);
  const [popularBooks, setPopularBooks] = useState<RankedBook[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination State
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Navigation State
  const [view, setView] = useState<'home' | 'profile'>('home');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [isMapView, setIsMapView] = useState(false);
  
  // Track which post is being edited
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  
  // Auth State Listener
  useEffect(() => {
    let unsubscribeUserDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUserDoc) unsubscribeUserDoc(); // Clean up previous listener

      if (firebaseUser && firebaseUser.uid) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        try {
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
             const newUser: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'User',
              email: firebaseUser.email || null,
              photoURL: firebaseUser.photoURL || null,
              followers: [],
              following: []
            };
            await setDoc(userRef, newUser);
          }

          unsubscribeUserDoc = onSnapshot(userRef, (docSnap) => {
             if (docSnap.exists()) {
                const userData = docSnap.data();
                setUser({
                  uid: firebaseUser.uid, 
                  displayName: userData.displayName || firebaseUser.displayName || 'User',
                  email: userData.email || firebaseUser.email || null,
                  photoURL: userData.photoURL || firebaseUser.photoURL || null,
                  followers: userData.followers || [],
                  following: userData.following || [],
                  bio: userData.bio || ''
                });
             }
          });

        } catch (error) {
          console.error("Error setting up user profile:", error);
           setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'User',
              email: firebaseUser.email || null,
              photoURL: firebaseUser.photoURL || null,
              followers: [],
              following: []
            });
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  const fetchPosts = async (isInitial = false) => {
    if (!hasMore && !isInitial) return;
    if (view !== 'home') return;
    
    if (feedType === FeedType.FOLLOWING && (!user || user.following.length === 0)) {
        setPosts([]);
        setHasMore(false);
        setPostsLoading(false);
        return;
    }

    if (isInitial) setPostsLoading(true);
    else setLoadingMore(true);

    try {
        let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

        if (feedType === FeedType.FOLLOWING && user) {
            const followingSlice = user.following.slice(0, 30);
            if (followingSlice.length > 0) {
                q = query(q, where('uid', 'in', followingSlice));
            }
        }

        q = query(q, limit(POSTS_PER_PAGE));

        if (!isInitial && lastDoc) {
            q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        const newPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));

        if (isInitial) {
            setPosts(newPosts);
        } else {
            setPosts(prev => [...prev, ...newPosts]);
        }

        setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(snapshot.docs.length === POSTS_PER_PAGE);

    } catch (err: any) {
        console.error("Error fetching posts:", err);
        setError("게시물을 불러올 수 없습니다. 권한 설정을 확인해주세요.");
    } finally {
        if (isInitial) setPostsLoading(false);
        else setLoadingMore(false);
    }
  };

  // Fetch Popular Books Ranking
  useEffect(() => {
    const fetchPopular = async () => {
      setPopularLoading(true);
      try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        const allPosts = snapshot.docs.map(doc => doc.data() as Post);
        
        const bookMap: { [key: string]: RankedBook } = {};
        
        allPosts.forEach(post => {
            const title = (post.bookTitle || "").trim();
            if (!title) return;

            if (bookMap[title]) {
                bookMap[title].totalLikes += (post.likes?.length || 0);
            } else {
                bookMap[title] = {
                    title: title,
                    author: post.bookAuthor,
                    coverImage: post.coverImage,
                    totalLikes: (post.likes?.length || 0)
                };
            }
        });

        const sorted = Object.values(bookMap)
            .sort((a, b) => b.totalLikes - a.totalLikes)
            .filter(b => b.totalLikes > 0 || allPosts.length > 0)
            .slice(0, 5);

        setPopularBooks(sorted);
      } catch (err) {
        console.error("Error fetching popular books:", err);
      } finally {
        setPopularLoading(false);
      }
    };

    if (!authLoading) {
      fetchPopular();
    }
  }, [authLoading, posts.length]);

  useEffect(() => {
    if (view === 'home' && !authLoading) {
        setPosts([]);
        setLastDoc(null);
        setHasMore(true);
        fetchPosts(true);
    }
  }, [feedType, user?.uid, view, authLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !postsLoading && !isMapView) {
            fetchPosts(false);
        }
    }, { threshold: 1.0 });

    if (loaderRef.current) {
        observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, postsLoading, lastDoc, feedType, isMapView]);


  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setFeedType(FeedType.GLOBAL);
    setView('home');
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingPost(null);
  };

  const handlePostSaved = (savedPost: Post, isEdit: boolean) => {
    setPosts(prev => {
        if (isEdit) {
            return prev.map(p => p.id === savedPost.id ? savedPost : p);
        } else {
            return [savedPost, ...prev];
        }
    });
  };

  const handleDeletePostState = (postId: string) => {
      setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const navigateToProfile = (uid: string) => {
    setProfileUserId(uid);
    setView('profile');
    window.scrollTo(0, 0);
  };

  const navigateToHome = () => {
    setView('home');
    setProfileUserId(null);
    window.scrollTo(0, 0);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <i className="fa-solid fa-book-open fa-bounce text-4xl text-amber-600"></i>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row max-w-7xl mx-auto bg-gray-50">
      {/* Sidebar (Desktop) / Topbar (Mobile) */}
      <aside className="md:w-64 bg-white border-r border-gray-200 md:h-screen md:sticky md:top-0 z-20">
        <div className="p-6 flex items-center gap-3 cursor-pointer" onClick={navigateToHome}>
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white">
            <i className="fa-solid fa-bookmark"></i>
          </div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 tracking-tight">북맥</h1>
        </div>

        <nav className="flex md:flex-col gap-2 p-4 md:p-6 overflow-x-auto no-scrollbar md:overflow-visible sticky top-0 bg-white border-b md:border-0 border-gray-200">
          <button 
            onClick={() => {
              setFeedType(FeedType.GLOBAL);
              navigateToHome();
            }}
            className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all ${view === 'home' && feedType === FeedType.GLOBAL ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <i className="fa-solid fa-globe text-lg w-6"></i>
            <span className="hidden md:inline">탐색</span>
          </button>
          
          {user && (
            <button 
              onClick={() => {
                setFeedType(FeedType.FOLLOWING);
                navigateToHome();
              }}
              className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all ${view === 'home' && feedType === FeedType.FOLLOWING ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <i className="fa-solid fa-user-group text-lg w-6"></i>
              <span className="hidden md:inline">팔로잉</span>
            </button>
          )}

          <div className="md:mt-auto pt-4 md:border-t border-gray-100 mt-0 ml-auto md:ml-0 flex md:block">
            {user ? (
               <div className="flex items-center gap-3 px-2 group cursor-pointer" onClick={() => navigateToProfile(user.uid)}>
                 <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Me" className="w-8 h-8 rounded-full border border-gray-300 object-cover" />
                 <div className="hidden md:block">
                    <p className="text-sm font-bold text-gray-900 truncate w-32 group-hover:text-amber-600 transition-colors">{user.displayName || 'User'}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleLogout(); }} 
                      className="text-xs text-red-500 hover:underline"
                    >
                      로그아웃
                    </button>
                 </div>
                 <button 
                    onClick={(e) => { e.stopPropagation(); handleLogout(); }} 
                    className="md:hidden text-gray-500 ml-2"
                 >
                    <i className="fa-solid fa-arrow-right-from-bracket"></i>
                 </button>
               </div>
            ) : (
                <button 
                  onClick={handleLogin}
                  className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  로그인 / 회원가입
                </button>
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
         {view === 'home' ? (
           <>
             <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        {feedType === FeedType.GLOBAL ? '추천 피드' : '팔로잉 피드'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {feedType === FeedType.GLOBAL ? '커뮤니티의 최신 독서 기록' : '친구들이 읽고 있는 책'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsMapView(!isMapView)}
                        className={`p-2 rounded-lg transition-colors ${isMapView ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'}`}
                        title={isMapView ? "리스트 보기" : "지도 보기"}
                    >
                        <i className={`fa-solid ${isMapView ? 'fa-list' : 'fa-map-location-dot'} text-lg`}></i>
                    </button>

                    {user && (
                        <button 
                            onClick={() => { setEditingPost(null); setIsCreateModalOpen(true); }}
                            className="hidden md:flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700 transition shadow-sm"
                        >
                            <i className="fa-solid fa-feather"></i>
                            새 글 쓰기
                        </button>
                    )}
                </div>
             </header>

             {error ? (
                 <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">
                     <i className="fa-solid fa-triangle-exclamation mb-2 text-2xl"></i>
                     <p>{error}</p>
                 </div>
             ) : (
                 <div className="space-y-6">
                    {posts.length === 0 && !postsLoading ? (
                        <div className="text-center py-20">
                            <div className="text-gray-300 text-6xl mb-4">
                                <i className="fa-solid fa-book-open"></i>
                            </div>
                            <p className="text-gray-500">
                                {feedType === FeedType.FOLLOWING ? '팔로우한 친구들의 게시물이 없습니다.' : '아직 게시물이 없습니다. 첫 번째 책을 공유해보세요!'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {isMapView ? (
                                <MapView posts={posts} />
                            ) : (
                                posts.map(post => (
                                    <PostCard 
                                        key={post.id} 
                                        post={post} 
                                        currentUser={user} 
                                        onEdit={handleEditPost}
                                        onUserClick={navigateToProfile}
                                        onDelete={handleDeletePostState}
                                    />
                                ))
                            )}

                            {!isMapView && (hasMore || loadingMore || postsLoading) && (
                                <div ref={loaderRef} className="py-8 flex justify-center">
                                    <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
                                </div>
                            )}
                            
                            {!hasMore && posts.length > 0 && !isMapView && (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    모든 게시물을 불러왔습니다.
                                </div>
                            )}
                        </>
                    )}
                 </div>
             )}
           </>
         ) : (
           <UserProfilePage 
             userId={profileUserId!} 
             currentUser={user}
             onBack={navigateToHome}
             onEditPost={handleEditPost}
             onUserClick={navigateToProfile}
           />
         )}
      </main>

      {/* Right Sidebar (Popular Ranking & Ad) */}
      <aside className="hidden lg:block w-80 p-8 border-l border-gray-200 sticky top-0 h-screen overflow-y-auto no-scrollbar">
         <div className="mb-8">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-crown text-amber-500"></i>
                인기 도서 랭킹
            </h3>
            <div className="space-y-6">
                {popularLoading ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <i className="fa-solid fa-spinner fa-spin text-amber-600 mb-2"></i>
                        <p className="text-xs text-gray-400">데이터를 집계 중입니다...</p>
                    </div>
                ) : popularBooks.length > 0 ? (
                    popularBooks.map((book, index) => (
                        <div key={book.title} className="flex gap-4 items-center group cursor-pointer">
                            <div className="relative flex-shrink-0">
                                <div className="w-14 h-20 bg-gray-100 rounded shadow-sm group-hover:shadow-md transition-all overflow-hidden border border-gray-100">
                                    <img 
                                        src={book.coverImage} 
                                        alt={book.title} 
                                        className="w-full h-full object-cover"
                                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150x200?text=No+Cover')}
                                    />
                                </div>
                                <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm
                                    ${index === 0 ? 'bg-yellow-400 text-white' : 
                                      index === 1 ? 'bg-gray-300 text-white' : 
                                      index === 2 ? 'bg-orange-400 text-white' : 'bg-white text-gray-400'}`}>
                                    {index + 1}
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="font-bold text-sm text-gray-900 group-hover:text-amber-600 transition-colors truncate" title={book.title}>{book.title}</p>
                                <p className="text-xs text-gray-500 mb-1">{book.author}</p>
                                <div className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
                                    <i className="fa-solid fa-heart"></i>
                                    <span>{book.totalLikes}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-xs text-gray-400">아직 등록된 도서가 없습니다.</p>
                    </div>
                )}
            </div>
         </div>

         {/* Kakao Ad Section */}
         <div className="mb-8 flex flex-col items-center">
            <span className="text-[9px] text-gray-400 mb-2 uppercase tracking-[0.2em] font-bold">Advertisement</span>
            <div className="bg-white border border-gray-100 rounded-lg overflow-hidden flex items-center justify-center shadow-sm" style={{ width: '300px', height: '250px' }}>
                <ins 
                  className="kakao_ad_area" 
                  style={{ display: 'none' }}
                  data-ad-unit="DAN-CRQmgBZtmIvxgGwT"
                  data-ad-width="300"
                  data-ad-height="250"
                ></ins>
            </div>
         </div>
         
         <div className="p-4 bg-gray-100 rounded-xl">
            <p className="text-xs text-gray-500 leading-relaxed">
                북맥 © 2024<br/>
                한 페이지씩, 당신의 독서 여정을 공유하세요.
            </p>
         </div>
      </aside>

      {/* Mobile Floating Action Button */}
      {user && view === 'home' && (
        <button 
            onClick={() => { setEditingPost(null); setIsCreateModalOpen(true); }}
            className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl z-30 hover:bg-amber-700 active:scale-95 transition-all"
        >
            <i className="fa-solid fa-feather"></i>
        </button>
      )}

      {/* Modals */}
      {isCreateModalOpen && user && (
          <CreatePostModal 
            currentUser={user} 
            onClose={handleCloseModal} 
            postToEdit={editingPost}
            onPostSaved={handlePostSaved}
          />
      )}
    </div>
  );
};

export default App;