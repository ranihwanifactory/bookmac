import React, { useState, useEffect } from 'react';
import { Post, Comment, UserProfile } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';

interface PostCardProps {
  post: Post;
  currentUser: UserProfile | null;
  onEdit?: (post: Post) => void;
  onUserClick?: (uid: string) => void;
  onDelete?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUser, onEdit, onUserClick, onDelete }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  
  // Comment Editing State
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Initialize state with safe defaults
  const likes = post.likes || [];
  const currentUid = currentUser?.uid || auth.currentUser?.uid;
  
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Sync state when props change
  useEffect(() => {
    const uid = currentUser?.uid || auth.currentUser?.uid;
    setIsLiked(likes.includes(uid || ''));
    setLikeCount(likes.length);
  }, [post.likes, currentUser]);

  // Load comments when toggled
  useEffect(() => {
    if (showComments) {
      setCommentError(null);
      
      // Use subcollection 'posts/{postId}/comments'
      const commentsRef = collection(db, 'posts', post.id, 'comments');
      // Simple orderBy should work without composite index for subcollections usually
      const q = query(commentsRef, orderBy('createdAt', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
        setComments(loadedComments);
      }, (error) => {
        console.error("Error fetching comments:", error);
        setCommentError("댓글을 불러올 수 없습니다 (권한 부족)");
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
    } catch (err: any) {
      // Revert if error
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
      console.error("Error liking post:", err);
      
      if (err.code === 'permission-denied') {
        alert("좋아요 권한이 없습니다. 관리자에게 문의하세요.");
      } else {
        alert("좋아요 반영 실패: " + err.message);
      }
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("이 게시물을 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(db, 'posts', post.id));
        if (onDelete) {
            onDelete(post.id);
        }
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
      // Add to subcollection 'posts/{postId}/comments'
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        parentId: null,
        uid: uid,
        authorName: currentUser?.displayName || auth.currentUser?.displayName || '익명',
        authorPhoto: currentUser?.photoURL || auth.currentUser?.photoURL || null,
        text: newComment,
        createdAt: Date.now()
      });
      
      setNewComment('');
    } catch (err: any) {
      console.error("Error adding comment:", err);
      if (err.code === 'permission-denied') {
        alert("댓글 작성 권한이 없습니다. 로그인 상태를 확인하거나 관리자에게 문의하세요.");
      } else {
        alert("댓글 작성 실패: " + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("정말 이 댓글을 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id, 'comments', commentId));
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      alert("댓글 삭제 실패: " + err.message);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editText.trim()) return;
    try {
      await updateDoc(doc(db, 'posts', post.id, 'comments', commentId), {
        text: editText
      });
      setEditingCommentId(null);
      setEditText('');
    } catch (err: any) {
      console.error("Error updating comment:", err);
      alert("댓글 수정 실패: " + err.message);
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR');
  };

  const handleUserClick = () => {
    if (onUserClick) {
      onUserClick(post.uid);
    }
  };

  return (
    <article className="bg-white border border-gray-200 rounded-lg mb-6 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div 
          className={`flex items-center gap-3 ${onUserClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={handleUserClick}
        >
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
            <div className="flex gap-1">
                {onEdit && (
                    <button onClick={() => onEdit(post)} className="text-gray-400 hover:text-amber-600 transition-colors p-2" title="수정">
                        <i className="fa-solid fa-pen"></i>
                    </button>
                )}
                <button onClick={handleDeletePost} className="text-gray-400 hover:text-red-500 transition-colors p-2" title="삭제">
                    <i className="fa-solid fa-trash"></i>
                </button>
            </div>
        )}
      </div>

      {/* Book Content */}
      <div className="px-4 pb-2">
        <div className="flex gap-4 mb-4 bg-amber-50 p-4 rounded-lg items-start relative">
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
            
            {/* Location Tag in Post */}
            {post.location && (
                <div className="absolute top-4 right-4 text-xs text-gray-400 flex items-center gap-1 bg-white bg-opacity-80 px-2 py-1 rounded-full shadow-sm">
                    <i className="fa-solid fa-location-dot text-red-400"></i>
                    <span>{post.location.name}</span>
                </div>
            )}
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
            {commentError && (
              <div className="text-red-500 text-xs text-center mb-2">{commentError}</div>
            )}

            {comments.length > 0 ? (
                comments.map((comment) => (
                    <div key={comment.id} className="mb-3 flex gap-2 group">
                        <img 
                            src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName}`} 
                            className="w-6 h-6 rounded-full mt-1 object-cover cursor-pointer"
                            alt={comment.authorName}
                            onClick={() => onUserClick && onUserClick(comment.uid)}
                        />
                        <div className="bg-white p-2.5 rounded-lg shadow-sm flex-1 relative">
                            {editingCommentId === comment.id ? (
                                <div className="flex flex-col gap-2">
                                    <input 
                                        type="text" 
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded p-1 focus:ring-1 focus:ring-amber-500 outline-none"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 text-xs">
                                        <button 
                                            onClick={() => setEditingCommentId(null)} 
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            취소
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateComment(comment.id)} 
                                            className="text-amber-600 font-bold hover:text-amber-700"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start">
                                        <span 
                                          className={`font-bold text-xs block text-gray-800 mb-1 ${onUserClick ? 'cursor-pointer hover:underline' : ''}`}
                                          onClick={() => onUserClick && onUserClick(comment.uid)}
                                        >
                                          {comment.authorName}
                                        </span>
                                        {/* Edit/Delete Buttons for Author */}
                                        {currentUser?.uid === comment.uid && (
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => startEditing(comment)} 
                                                    className="text-gray-400 hover:text-amber-600 text-xs p-1"
                                                    title="수정"
                                                >
                                                    <i className="fa-solid fa-pen"></i>
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteComment(comment.id)} 
                                                    className="text-gray-400 hover:text-red-500 text-xs p-1"
                                                    title="삭제"
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-700 break-words">{comment.text}</p>
                                </>
                            )}
                        </div>
                    </div>
                ))
            ) : (
                !commentError && (
                  <div className="text-center py-4 text-gray-400 text-xs">
                      첫 댓글을 남겨보세요!
                  </div>
                )
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