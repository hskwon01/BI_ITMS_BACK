const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin, requireTeam } = require('../middleware/auth');
const { 
  listProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getCategories 
} = require('../models/productModel');

// 제품 목록 조회 (모든 사용자)
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, category = '', search = '', active_only = 'true' } = req.query;
    const result = await listProducts({ 
      limit: Number(limit), 
      offset: Number(offset), 
      category,
      search,
      active_only: active_only === 'true'
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '제품 목록 조회 실패' });
  }
});

// 카테고리 목록 조회 (모든 사용자)
router.get('/categories', async (req, res) => {
  try {
    const categories = await getCategories();
    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '카테고리 조회 실패' });
  }
});

// 제품 상세 조회 (모든 사용자)
router.get('/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ message: '제품을 찾을 수 없습니다.' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '제품 조회 실패' });
  }
});

// 제품 생성 (관리자/팀만)
router.post('/', verifyToken, requireTeam, async (req, res) => {
  try {
    const { name, category, description, base_price, unit } = req.body;
    
    if (!name || !category || !base_price) {
      return res.status(400).json({ message: '제품명, 카테고리, 가격은 필수입니다.' });
    }

    if (base_price < 0 || base_price > 9999999999999.99) {
      return res.status(400).json({ message: '가격은 0 이상 9,999,999,999,999.99원 이하여야 합니다.' });
    }

    const product = await createProduct({ 
      name, 
      category, 
      description, 
      base_price: Number(base_price),
      unit: unit || '개',
      created_by: req.user.id 
    });
    
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '제품 생성 실패' });
  }
});

// 제품 수정 (관리자/팀만)
router.put('/:id', verifyToken, requireTeam, async (req, res) => {
  try {
    const { name, category, description, base_price, unit, is_active } = req.body;

    if (base_price !== undefined && (base_price < 0 || base_price > 9999999999999.99)) {
      return res.status(400).json({ message: '가격은 0 이상 9,999,999,999,999.99원 이하여야 합니다.' });
    }

    const product = await updateProduct(req.params.id, { 
      name, 
      category, 
      description, 
      base_price: base_price ? Number(base_price) : undefined,
      unit, 
      is_active 
    });
    
    if (!product) return res.status(404).json({ message: '제품을 찾을 수 없습니다.' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '제품 수정 실패' });
  }
});

// 제품 삭제 (비활성화) (관리자/팀만)
router.delete('/:id', verifyToken, requireTeam, async (req, res) => {
  try {
    const product = await deleteProduct(req.params.id);
    if (!product) return res.status(404).json({ message: '제품을 찾을 수 없습니다.' });
    res.json({ message: '제품이 비활성화되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '제품 삭제 실패' });
  }
});

module.exports = router;
