const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin, requireTeam } = require('../middleware/auth');
const { 
  listQuotes, 
  getQuoteById, 
  createQuote, 
  updateQuote, 
  deleteQuote,
  addQuoteItem,
  updateQuoteItem,
  deleteQuoteItem
} = require('../models/quoteModel');

// 견적 목록 조회
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, status = '', search = '' } = req.query;
    const user = req.user;
    
    // 일반 사용자는 자신의 견적만, 관리자/팀은 모든 견적 조회 가능
    const customer_id = (user.role === 'admin' || user.role === 'itsm_team') ? null : user.id;
    
    const result = await listQuotes({ 
      limit: Number(limit), 
      offset: Number(offset), 
      customer_id,
      status,
      search
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 목록 조회 실패' });
  }
});

// 견적 상세 조회
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    
    const user = req.user;
    // 일반 사용자는 자신의 견적만 조회 가능
    if (user.role !== 'admin' && user.role !== 'itsm_team' && quote.customer_id !== user.id) {
      return res.status(403).json({ message: '접근 권한이 없습니다.' });
    }
    
    res.json(quote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 조회 실패' });
  }
});

// 견적 생성
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, valid_until, notes, customer_name, customer_email, customer_company } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: '제목은 필수입니다.' });
    }

    const user = req.user;
    const quote = await createQuote({ 
      customer_id: user.id,
      customer_name: customer_name || user.name,
      customer_email: customer_email || user.email,
      customer_company: customer_company || user.company || '',
      title,
      valid_until,
      notes
    });
    
    res.status(201).json(quote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 생성 실패' });
  }
});

// 견적 수정
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    
    const user = req.user;
    // 일반 사용자는 자신의 견적만, 관리자/팀은 모든 견적 수정 가능
    if (user.role !== 'admin' && user.role !== 'itsm_team' && quote.customer_id !== user.id) {
      return res.status(403).json({ message: '수정 권한이 없습니다.' });
    }

    const { title, status, valid_until, notes } = req.body;
    const updatedQuote = await updateQuote(req.params.id, { title, status, valid_until, notes });
    
    res.json(updatedQuote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 수정 실패' });
  }
});

// 견적 삭제
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    
    const user = req.user;
    // 일반 사용자는 자신의 견적만, 관리자/팀은 모든 견적 삭제 가능
    if (user.role !== 'admin' && user.role !== 'itsm_team' && quote.customer_id !== user.id) {
      return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    }

    await deleteQuote(req.params.id);
    res.json({ message: '견적이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 삭제 실패' });
  }
});

// 견적 항목 추가
router.post('/:id/items', verifyToken, async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    
    const user = req.user;
    // 권한 확인
    if (user.role !== 'admin' && user.role !== 'itsm_team' && quote.customer_id !== user.id) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const { product_id, product_name, product_description, quantity, unit_price } = req.body;
    
    if (!product_name || !quantity || !unit_price) {
      return res.status(400).json({ message: '제품명, 수량, 단가는 필수입니다.' });
    }

    if (quantity <= 0 || unit_price < 0) {
      return res.status(400).json({ message: '수량은 1 이상, 단가는 0 이상이어야 합니다.' });
    }

    const item = await addQuoteItem({ 
      quote_id: req.params.id,
      product_id,
      product_name,
      product_description,
      quantity: Number(quantity),
      unit_price: Number(unit_price)
    });
    
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 항목 추가 실패' });
  }
});

// 견적 항목 수정
router.put('/:id/items/:itemId', verifyToken, async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    
    const user = req.user;
    // 권한 확인
    if (user.role !== 'admin' && user.role !== 'itsm_team' && quote.customer_id !== user.id) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const { quantity, unit_price, product_description } = req.body;

    if (quantity !== undefined && quantity <= 0) {
      return res.status(400).json({ message: '수량은 1 이상이어야 합니다.' });
    }

    if (unit_price !== undefined && unit_price < 0) {
      return res.status(400).json({ message: '단가는 0 이상이어야 합니다.' });
    }

    const item = await updateQuoteItem(req.params.itemId, { 
      quantity: quantity ? Number(quantity) : undefined,
      unit_price: unit_price ? Number(unit_price) : undefined,
      product_description
    });
    
    if (!item) return res.status(404).json({ message: '견적 항목을 찾을 수 없습니다.' });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 항목 수정 실패' });
  }
});

// 견적 항목 삭제
router.delete('/:id/items/:itemId', verifyToken, async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    
    const user = req.user;
    // 권한 확인
    if (user.role !== 'admin' && user.role !== 'itsm_team' && quote.customer_id !== user.id) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const item = await deleteQuoteItem(req.params.itemId);
    if (!item) return res.status(404).json({ message: '견적 항목을 찾을 수 없습니다.' });
    
    res.json({ message: '견적 항목이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 항목 삭제 실패' });
  }
});

// 관리자용: 견적 요청 목록 조회
router.get('/admin/requests', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status = '', limit = 20, offset = 0 } = req.query;
    
    // status가 빈 문자열이면 'pending'으로 설정, 아니면 전달받은 값 사용
    const statusFilter = status === '' ? 'pending' : status;
    
    const result = await listQuotes({ 
      limit: Number(limit), 
      offset: Number(offset), 
      status: statusFilter,
      customer_id: null // 모든 고객의 견적
    });
    
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 요청 목록 조회 실패' });
  }
});

// 관리자용: 견적 요청 승인
router.post('/admin/requests/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) {
      return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    }

    if (quote.status !== 'pending') {
      return res.status(400).json({ message: '승인 대기 상태의 견적만 승인할 수 있습니다.' });
    }

    const updatedQuote = await updateQuote(req.params.id, { 
      status: 'approved',
      notes: quote.notes ? `${quote.notes}\n\n[관리자 승인] ${new Date().toLocaleString('ko-KR')}` : `[관리자 승인] ${new Date().toLocaleString('ko-KR')}`
    });

    res.json({ 
      message: '견적 요청이 승인되었습니다.',
      quote: updatedQuote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 요청 승인 실패' });
  }
});

// 관리자용: 견적 요청 거부
router.post('/admin/requests/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const quote = await getQuoteById(req.params.id);
    
    if (!quote) {
      return res.status(404).json({ message: '견적을 찾을 수 없습니다.' });
    }

    if (quote.status !== 'pending') {
      return res.status(400).json({ message: '승인 대기 상태의 견적만 거부할 수 있습니다.' });
    }

    const updatedQuote = await updateQuote(req.params.id, { 
      status: 'rejected',
      notes: quote.notes ? `${quote.notes}\n\n[관리자 거부] ${reason || '사유 없음'} - ${new Date().toLocaleString('ko-KR')}` : `[관리자 거부] ${reason || '사유 없음'} - ${new Date().toLocaleString('ko-KR')}`
    });

    res.json({ 
      message: '견적 요청이 거부되었습니다.',
      quote: updatedQuote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '견적 요청 거부 실패' });
  }
});

module.exports = router;




