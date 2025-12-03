import React, { useState, useEffect } from 'react';
import { Post, Comment, UserProfile } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';

interface PostCardProps {
  post: Post;
  currentUser: UserProfile | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUser }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Initialize state with safe defaults
  const likes = post.likes || [];
  const currentUid = currentUser?.uid || auth.currentUser?.uid;
  
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Sync state when props change (e.g. login status or realtime updates)
  useEffect(() => {
    const uid = currentUser?.uid || auth.currentUser?.uid;
    setIsLiked(likes.includes(uid || ''));
    setLikeCount(likes.length);
  }, [post.likes, currentUser]);

  // Load comments when toggled
  useEffect(() => {
    if (showComments) {
      const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      });
      return () => unsubscribe();
    }
  }, [showComments, post.id]);

  const handleLike = async () => {
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (!uid) return alert("좋아요를 누르려면 로그인이 필요합니다.");
    
    const postRef = doc(db, 'posts', post.id);
    const wasLiked = isLiked;
    
    // Optimistic UI update
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        await updateDoc(postRef, { likes: arrayRemove(uid) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(uid) });
      }
    } catch (err) {
      // Revert if error
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
      console.error("Error liking post:", err);
      alert("좋아요 반영 실패");
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("이 게시물을 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(db, 'posts', post.id));
    } catch (e) {
        console.error("Error deleting post", e);
        alert("삭제 중 오류가 발생했습니다.");
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (!uid) {
        alert("로그인이 필요합니다.");
        return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        parentId: null, // Top level comment
        uid: uid,
        authorName: currentUser?.displayName || auth.currentUser?.displayName || '익명',
        authorPhoto: currentUser?.photoURL || auth.currentUser?.photoURL || null,
        text: newComment,
        createdAt: Date.now()
      });
      
      setNewComment('');
    } catch (err) {
      console.error("Error adding comment:", err);
      alert("댓글 작성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR');
  };

  return (
    <article className="bg-white border border-gray-200 rounded-lg mb-6 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <img 
            src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`} 
            alt={post.authorName} 
            className="w-8 h-8 rounded-full object-cover border border-gray-200"
          />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{post.authorName}</h3>
            <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
          </div>
        </div>
        {currentUid === post.uid && (
            <button onClick={handleDeletePost} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                <i className="fa-solid fa-trash"></i>
            </button>
        )}
      </div>

      {/* Book Content */}
      <div className="px-4 pb-2">
        <div className="flex gap-4 mb-4 bg-amber-50 p-4 rounded-lg items-start">
           <img 
              src={post.coverImage || 'https://via.placeholder.com/150'} 
              alt={post.bookTitle}
              className="w-20 h-auto object-cover shadow-md rounded-sm flex-shrink-0"
              style={{maxHeight: '120px'}}
            />
            <div>
                <h2 className="font-serif font-bold text-lg text-gray-900 leading-tight mb-1">{post.bookTitle}</h2>
                <p className="text-sm text-gray-600 mb-2">{post.bookAuthor} 저</p>
                <div className="flex text-yellow-400 text-xs mb-2">
                    {[...Array(5)].map((_, i) => (
                        <i key={i} className={`fa-star ${i < post.rating ? 'fa-solid' : 'fa-regular'} mr-1`}></i>
                    ))}
                </div>
            </div>
        </div>

        {post.quote && (
          <div className="mb-4 pl-4 border-l-4 border-amber-300">
            <p className="font-serif italic text-gray-800 text-base leading-relaxed">"{post.quote}"</p>
          </div>
        )}
        
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{post.review}</p>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-6">
        <button 
          onClick={handleLike} 
          className={`flex items-center gap-2 text-sm transition-colors group ${isLiked ? 'text-red-500' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <i className={`${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-xl group-active:scale-125 transition-transform`}></i>
          <span>{likeCount}</span>
        </button>

        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <i className="fa-regular fa-comment text-xl"></i>
          <span>{comments.length > 0 ? comments.length : '댓글'}</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="bg-gray-50 border-t border-gray-100 p-4 animate-fade-in">
            {comments.length > 0 ? (
                comments.map((comment) => (
                    <div key={comment.id} className="mb-3 flex gap-2">
                        <img 
                            src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName}`} 
                            className="w-6 h-6 rounded-full mt-1 object-cover"
                            alt={comment.authorName}
                        />
                        <div className="bg-white p-2.5 rounded-lg shadow-sm flex-1">
                            <span className="font-bold text-xs block text-gray-800 mb-1">{comment.authorName}</span>
                            <p className="text-sm text-gray-700 break-words">{comment.text}</p>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-4 text-gray-400 text-xs">
                    첫 댓글을 남겨보세요!
                </div>
            )}
            
            {currentUser ? (
                <form onSubmit={handleAddComment} className="flex gap-2 mt-4">
                    <input
                        type="text"
                        placeholder="댓글을 입력하세요..."
                        className="flex-1 text-sm border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button 
                        type="submit"
                        disabled={!newComment.trim() || submitting}
                        className="text-amber-600 font-semibold text-sm disabled:opacity-50 px-2 whitespace-nowrap"
                    >
                        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : '게시'}
                    </button>
                </form>
            ) : (
                <p className="text-xs text-gray-500 text-center mt-2 p-2 bg-gray-100 rounded">
                    댓글을 작성하려면 <button onClick={() => alert('상단의 로그인 버튼을 이용해주세요.')} className="text-amber-600 font-bold hover:underline">로그인</button>하세요.
                </p>
            )}
        </div>
      )}
    </article>
  );
};

export default PostCard;