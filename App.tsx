import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, setDoc, doc, getDoc, where, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserProfile, Post, FeedType } from './types';
import PostCard from './components/PostCard';
import CreatePostModal from './components/CreatePostModal';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<FeedType>(FeedType.GLOBAL);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track which post is being edited
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  
  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.uid) {
        // Fetch or create user profile in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUser({
              uid: firebaseUser.uid, 
              displayName: userData.displayName || firebaseUser.displayName || 'User',
              email: userData.email || firebaseUser.email || null,
              photoURL: userData.photoURL || firebaseUser.photoURL || null,
              followers: userData.followers || [],
              following: userData.following || [],
              bio: userData.bio || ''
            });
          } else {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'User',
              email: firebaseUser.email || null,
              photoURL: firebaseUser.photoURL || null,
              followers: [],
              following: []
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // Fallback to basic auth info if firestore fails
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
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Posts
  useEffect(() => {
    let q;
    const postsRef = collection(db, 'posts');
    q = query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      if (feedType === FeedType.FOLLOWING && user) {
        const followingPosts = allPosts.filter(p => user.following.includes(p.uid) || p.uid === user.uid);
        setPosts(followingPosts);
      } else {
        setPosts(allPosts);
      }
      setError(null);
    }, (err) => {
        console.error("Error fetching posts:", err);
        setError("게시물을 불러올 수 없습니다. 권한 설정을 확인해주세요.");
    });

    return () => unsubscribe();
  }, [feedType, user]);

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
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingPost(null);
  };

  if (loading) {
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
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white">
            <i className="fa-solid fa-bookmark"></i>
          </div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 tracking-tight">BookMac</h1>
        </div>

        <nav className="flex md:flex-col gap-2 p-4 md:p-6 overflow-x-auto no-scrollbar md:overflow-visible sticky top-0 bg-white border-b md:border-0 border-gray-200">
          <button 
            onClick={() => setFeedType(FeedType.GLOBAL)}
            className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all ${feedType === FeedType.GLOBAL ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <i className="fa-solid fa-globe text-lg w-6"></i>
            <span className="hidden md:inline">탐색</span>
          </button>
          
          {user && (
            <button 
              onClick={() => setFeedType(FeedType.FOLLOWING)}
              className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all ${feedType === FeedType.FOLLOWING ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <i className="fa-solid fa-user-group text-lg w-6"></i>
              <span className="hidden md:inline">팔로잉</span>
            </button>
          )}

          <div className="md:mt-auto pt-4 md:border-t border-gray-100 mt-0 ml-auto md:ml-0 flex md:block">
            {user ? (
               <div className="flex items-center gap-3 px-2">
                 <img src={user.photoURL || ''} alt="Me" className="w-8 h-8 rounded-full border border-gray-300" />
                 <div className="hidden md:block">
                    <p className="text-sm font-bold text-gray-900 truncate w-32">{user.displayName || 'User'}</p>
                    <button onClick={handleLogout} className="text-xs text-red-500 hover:underline">로그아웃</button>
                 </div>
                 {/* Mobile Logout Icon */}
                 <button onClick={handleLogout} className="md:hidden text-gray-500 ml-2">
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

      {/* Main Feed */}
      <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
         <header className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-xl font-bold text-gray-900">
                    {feedType === FeedType.GLOBAL ? '추천 피드' : '팔로잉 피드'}
                </h2>
                <p className="text-gray-500 text-sm">
                    {feedType === FeedType.GLOBAL ? '커뮤니티의 최신 독서 기록' : '친구들이 읽고 있는 책'}
                </p>
            </div>
            {/* Create Button (Desktop/Header) */}
            {user && (
                <button 
                    onClick={() => { setEditingPost(null); setIsCreateModalOpen(true); }}
                    className="hidden md:flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700 transition shadow-sm"
                >
                    <i className="fa-solid fa-feather"></i>
                    새 글 쓰기
                </button>
            )}
         </header>

         {error ? (
             <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">
                 <i className="fa-solid fa-triangle-exclamation mb-2 text-2xl"></i>
                 <p>{error}</p>
             </div>
         ) : (
             <div className="space-y-6">
                {posts.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-gray-300 text-6xl mb-4">
                            <i className="fa-solid fa-book-open"></i>
                        </div>
                        <p className="text-gray-500">아직 게시물이 없습니다. 첫 번째 책을 공유해보세요!</p>
                    </div>
                ) : (
                    posts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            currentUser={user} 
                            onEdit={handleEditPost} 
                        />
                    ))
                )}
             </div>
         )}
      </main>

      {/* Right Sidebar (Trending/Suggestions) */}
      <aside className="hidden lg:block w-80 p-8 border-l border-gray-200 sticky top-0 h-screen">
         <div className="mb-8">
            <h3 className="font-bold text-gray-900 mb-4">인기 도서</h3>
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 items-center group cursor-pointer">
                        <div className="w-12 h-16 bg-gray-200 rounded shadow-sm group-hover:shadow-md transition-all"></div>
                        <div>
                            <p className="font-semibold text-sm group-hover:text-amber-600 transition-colors">The Midnight Library</p>
                            <p className="text-xs text-gray-500">Matt Haig</p>
                        </div>
                    </div>
                ))}
            </div>
         </div>
         <div className="p-4 bg-gray-100 rounded-xl">
            <p className="text-xs text-gray-500 leading-relaxed">
                BookMac © 2024<br/>
                한 페이지씩, 당신의 독서 여정을 공유하세요.
            </p>
         </div>
      </aside>

      {/* Mobile Floating Action Button */}
      {user && (
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
          />
      )}
    </div>
  );
};

export default App;