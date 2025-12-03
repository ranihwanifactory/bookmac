import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';
import { generateBookContent } from '../services/geminiService';

interface CreatePostModalProps {
  currentUser: UserProfile;
  onClose: () => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ currentUser, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [quote, setQuote] = useState('');
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(5);
  // Mocking image upload by just using a random book cover or text input
  // In real app: Use Firebase Storage
  const [coverUrl, setCoverUrl] = useState('');

  const handleAiAssist = async () => {
    if (!title || !author) {
      alert("먼저 책 제목과 저자를 입력해주세요.");
      return;
    }
    
    // Check if API key is in env (client side check for demo)
    if (!process.env.API_KEY) {
        alert("환경 설정에 Gemini API 키가 누락되었습니다.");
        return;
    }

    setAiLoading(true);
    const result = await generateBookContent(title, author);
    setAiLoading(false);

    if (result) {
      setReview(result.review);
      setQuote(result.quote);
    } else {
      alert("AI가 내용을 생성하지 못했습니다. 다시 시도하거나 직접 작성해주세요.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !review) return;

    setLoading(true);
    try {
      // Use a placeholder if no URL provided
      const finalCover = coverUrl.trim() || `https://covers.openlibrary.org/b/title/${encodeURIComponent(title)}-L.jpg?default=false`;

      await addDoc(collection(db, 'posts'), {
        uid: currentUser.uid,
        authorName: currentUser.displayName || '익명', // Prevent undefined
        authorPhoto: currentUser.photoURL || null, // Prevent undefined (Firestore supports null)
        bookTitle: title,
        bookAuthor: author,
        coverImage: finalCover,
        quote,
        review,
        rating,
        likes: [],
        createdAt: Date.now() // Use client TS for immediate ordering or serverTimestamp for consistency
      });
      onClose();
    } catch (error) {
      console.error("Error creating post", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
          <h2 className="font-bold text-lg">새 추천 작성</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-xs font-medium text-gray-700 mb-1">책 제목</label>
               <input 
                 value={title} 
                 onChange={e => setTitle(e.target.value)} 
                 className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" 
                 placeholder="예: 위대한 개츠비"
               />
            </div>
            <div>
               <label className="block text-xs font-medium text-gray-700 mb-1">저자</label>
               <input 
                 value={author} 
                 onChange={e => setAuthor(e.target.value)} 
                 className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" 
                 placeholder="예: F. 스콧 피츠제럴드"
               />
            </div>
          </div>

          <div>
             <label className="block text-xs font-medium text-gray-700 mb-1">표지 이미지 URL (선택)</label>
             <input 
               value={coverUrl} 
               onChange={e => setCoverUrl(e.target.value)} 
               className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" 
               placeholder="https://..."
             />
             <p className="text-[10px] text-gray-400 mt-1">비워두면 OpenLibrary에서 자동으로 가져옵니다.</p>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
             <div className="flex justify-between items-center mb-2">
                 <span className="text-xs font-bold text-amber-800">AI 도우미</span>
                 <button 
                   type="button"
                   onClick={handleAiAssist}
                   disabled={aiLoading || !title}
                   className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50"
                 >
                   {aiLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                   자동 완성
                 </button>
             </div>
             <p className="text-[10px] text-amber-700">제목과 저자를 입력하고 클릭하면 서평과 명언을 자동으로 생성해줍니다.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">평점</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button 
                  key={star} 
                  type="button" 
                  onClick={() => setRating(star)}
                  className={`text-xl transition-transform hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                >
                  <i className="fa-solid fa-star"></i>
                </button>
              ))}
            </div>
          </div>

          <div>
             <label className="block text-xs font-medium text-gray-700 mb-1">기억에 남는 구절</label>
             <textarea 
               value={quote} 
               onChange={e => setQuote(e.target.value)} 
               className="w-full border border-gray-300 rounded-lg p-2 text-sm font-serif italic focus:ring-2 focus:ring-amber-500 outline-none" 
               placeholder="가장 기억에 남는 한 문장..."
               rows={2}
             />
          </div>

          <div>
             <label className="block text-xs font-medium text-gray-700 mb-1">나의 서평</label>
             <textarea 
               value={review} 
               onChange={e => setReview(e.target.value)} 
               className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" 
               placeholder="이 책 어떠셨나요?"
               rows={4}
             />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
           <button 
             onClick={handleSubmit} 
             disabled={loading || !title || !review}
             className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
           >
             {loading ? '게시 중...' : '추천 공유하기'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;
