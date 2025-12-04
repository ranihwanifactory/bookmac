import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserProfile, Post } from '../types';
import PostCard from './PostCard';
import EditProfileModal from './EditProfileModal';

interface UserProfilePageProps {
  userId: string;
  currentUser: UserProfile | null;
  onBack: () => void;
  onEditPost: (post: Post) => void;
  onUserClick: (uid: string) => void;
}

const UserProfilePage: React.FC<UserProfilePageProps> = ({ userId, currentUser, onBack, onEditPost, onUserClick }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = currentUser?.uid === userId;
  const isFollowing = profile?.followers?.includes(currentUser?.uid || '');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch User Data
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }

        // Fetch User's Posts
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, where('uid', '==', userId), orderBy('createdAt', 'desc'));
        
        const querySnapshot = await getDocs(q);
        const userPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        setPosts(userPosts);
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId]);

  const handleFollowToggle = async () => {
    if (!currentUser) return alert("로그인이 필요합니다.");
    if (!profile) return;
    
    setFollowLoading(true);
    try {
        const batch = writeBatch(db);
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const targetUserRef = doc(db, 'users', userId);

        if (isFollowing) {
            // Unfollow
            batch.update(currentUserRef, { following: arrayRemove(userId) });
            batch.update(targetUserRef, { followers: arrayRemove(currentUser.uid) });
            
            // Optimistic Update
            setProfile(prev => prev ? ({
                ...prev,
                followers: prev.followers.filter(uid => uid !== currentUser.uid)
            }) : null);
        } else {
            // Follow
            batch.update(currentUserRef, { following: arrayUnion(userId) });
            batch.update(targetUserRef, { followers: arrayUnion(currentUser.uid) });

             // Optimistic Update
             setProfile(prev => prev ? ({
                ...prev,
                followers: [...prev.followers, currentUser.uid]
            }) : null);
        }

        await batch.commit();

    } catch (error) {
        console.error("Error toggling follow:", error);
        alert("작업을 처리하는 중 오류가 발생했습니다.");
    } finally {
        setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-gray-400 gap-4">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-amber-600"></i>
        <p>프로필을 불러오는 중...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
         <i className="fa-solid fa-user-slash text-4xl text-gray-300 mb-4"></i>
         <p className="text-gray-500">사용자를 찾을 수 없습니다.</p>
         <button onClick={onBack} className="mt-4 text-amber-600 font-bold hover:underline">돌아가기</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-10">
      {/* Header Navigation */}
      <button 
        onClick={onBack} 
        className="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors font-medium text-sm group"
      >
        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center group-hover:border-gray-400">
             <i className="fa-solid fa-arrow-left"></i>
        </div>
        돌아가기
      </button>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 shadow-sm mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-amber-50 to-orange-50 opacity-50"></div>
        
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 mt-4">
          <div className="relative group">
              <img 
                src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} 
                alt={profile.displayName || 'User'} 
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-white shadow-lg"
              />
              {isOwnProfile && (
                  <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="absolute bottom-1 right-1 bg-white text-gray-700 w-8 h-8 rounded-full shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors md:hidden"
                  >
                      <i className="fa-solid fa-pen text-xs"></i>
                  </button>
              )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2 justify-center md:justify-start">
                <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
                {isOwnProfile ? (
                    <button 
                        onClick={() => setIsEditModalOpen(true)}
                        className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium text-gray-700 transition-colors"
                    >
                        <i className="fa-solid fa-pen"></i> 수정
                    </button>
                ) : (
                    <button
                        onClick={handleFollowToggle}
                        disabled={followLoading || !currentUser}
                        className={`hidden md:flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors shadow-sm
                            ${isFollowing 
                                ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50' 
                                : 'bg-black text-white hover:bg-gray-800'
                            }`}
                    >
                       {followLoading ? (
                           <i className="fa-solid fa-spinner fa-spin"></i>
                       ) : isFollowing ? (
                           <>
                               <i className="fa-solid fa-check"></i> 팔로잉
                           </>
                       ) : (
                           <>
                               <i className="fa-solid fa-plus"></i> 팔로우
                           </>
                       )}
                    </button>
                )}
            </div>
            
            <p className="text-gray-600 text-sm mb-6 leading-relaxed max-w-lg mx-auto md:mx-0">
                {profile.bio || '자기소개가 없습니다.'}
            </p>
            
            <div className="flex justify-center md:justify-start gap-8 border-t border-gray-100 pt-4 md:border-0 md:pt-0">
              <div className="text-center md:text-left">
                <span className="block font-bold text-gray-900 text-lg">{posts.length}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">게시물</span>
              </div>
              <div className="text-center md:text-left">
                <span className="block font-bold text-gray-900 text-lg">{profile.followers?.length || 0}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">팔로워</span>
              </div>
              <div className="text-center md:text-left">
                <span className="block font-bold text-gray-900 text-lg">{profile.following?.length || 0}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">팔로잉</span>
              </div>
            </div>

            {/* Mobile Action Button */}
            {!isOwnProfile && (
                <div className="md:hidden mt-6">
                    <button
                        onClick={handleFollowToggle}
                        disabled={followLoading || !currentUser}
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-colors
                            ${isFollowing 
                                ? 'bg-white border border-gray-300 text-gray-700' 
                                : 'bg-black text-white'
                            }`}
                    >
                       {followLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : (isFollowing ? '팔로잉' : '팔로우 하기')}
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Posts Grid/List */}
      <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-layer-group text-amber-600"></i>
          <span>작성한 글</span>
      </h2>
      
      <div className="space-y-6">
        {posts.length > 0 ? (
          posts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              currentUser={currentUser} 
              onEdit={onEditPost}
              onUserClick={onUserClick}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <i className="fa-regular fa-folder-open text-2xl text-gray-300"></i>
            </div>
            <p className="text-gray-500 text-sm">작성한 게시물이 없습니다.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && isOwnProfile && profile && (
        <EditProfileModal 
          user={profile} 
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={(updates) => {
             // Optimistic update
             setProfile(prev => prev ? ({ ...prev, ...updates }) : null);
          }}
        />
      )}
    </div>
  );
};

export default UserProfilePage;