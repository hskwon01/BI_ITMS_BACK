const nodemailer = require('nodemailer');
require('dotenv').config();
const pool = require('../config/db'); // pool 임포트

// 이메일 전송을 위한 transporter 설정
const transporter = nodemailer.createTransport({
  service: 'gmail', // Gmail 사용
  auth: {
    user: process.env.EMAIL_USER, // Gmail 계정
    pass: process.env.EMAIL_PASS  // Gmail 앱 비밀번호
  }
});


// 인증 코드 생성 함수
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 이메일 발송 함수
const sendVerificationEmail = async (email, verificationCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: '[ITMS] 이메일 인증 코드',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3652; text-align: center;">ITMS 이메일 인증</h2>
        <div style="background: #f6f8fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
            안녕하세요! ITMS 회원가입을 위한 이메일 인증 코드를 발송드립니다.
          </p>
          <div style="background: #fff; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #e2e8f0;">
            <h3 style="color: #2d3652; margin: 0 0 10px 0;">인증 코드</h3>
            <div style="font-size: 32px; font-weight: bold; color: #7c83fd; letter-spacing: 5px; margin: 10px 0;">
              ${verificationCode}
            </div>
          </div>
          <p style="color: #7b8190; font-size: 14px; margin-top: 20px;">
            이 인증 코드는 10분간 유효합니다. 타인에게 공유하지 마세요.
          </p>
        </div>
        <p style="color: #7b8190; font-size: 12px; text-align: center;">
          © 2025 ITMS. All rights reserved.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// 관리자 승인 알림 메일 발송 함수
const sendAdminApprovalNotification = async (adminEmails, newUser) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: adminEmails.join(', '),
    subject: '[ITMS] 새로운 사용자 승인 요청',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3652; text-align: center;">새로운 사용자 승인 요청</h2>
        <div style="background: #f6f8fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
            새로운 사용자가 ITMS에 가입했습니다. 승인 처리가 필요합니다.
          </p>
          <div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #e2e8f0;">
            <h3 style="color: #2d3652; margin: 0 0 15px 0;">사용자 정보</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">이름:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${newUser.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">이메일:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${newUser.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">회사:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${newUser.company_name || '미입력'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4a5568;">가입일시:</td>
                <td style="padding: 8px 0; color: #2d3652;">${new Date(newUser.created_at).toLocaleString('ko-KR')}</td>
              </tr>
            </table>
          </div>
          <div style="background: #e6ffe6; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #38a169;">
            <p style="color: #2d3652; font-size: 14px; margin: 0;">
              <strong>관리자 페이지</strong>에서 사용자 <strong>승인/거부</strong>를 처리할 수 있습니다.
            </p>
          </div>
        </div>
        <p style="color: #7b8190; font-size: 12px; text-align: center;">
          © 2025 ITMS. All rights reserved.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Admin notification email sending error:', error);
    return false;
  }
};


// 사용자에게 회원가입 승인 이메일 발송 함수
const sendApprovalEmail = async (to, name) => {
  const mailOptions = {
    from: `"ITMS 지원팀" <${process.env.EMAIL_USER}>`,
    to,
    subject: '계정 승인 완료 안내',
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d3652; text-align: center;">ITMS 계정 승인 완료</h2>
      <div style="background: #f6f8fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
          안녕하세요, <strong>${name}</strong>님!
        </p>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
          회원님의 계정이 <strong style="color: #7c83fd;">정상적으로 승인</strong>되었습니다.
          <br />
          이제 <strong>ITMS 시스템</strong>을 자유롭게 이용하실 수 있습니다.
        </p>
        <p style="color: #7b8190; font-size: 14px; margin-top: 20px;">
          문제가 있거나 도움이 필요하시면 언제든지 ITMS 지원팀에 문의해 주세요.
        </p>
      </div>
      <p style="color: #7b8190; font-size: 12px; text-align: center;">
        © 2025 ITMS. All rights reserved.
      </p>
    </div>
  `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Send approval email sending error:', error);
    return false;
  }
}


// 관리자에게 새 티켓 알림 메일 발송 함수
const sendTicketNotificationToAdmin = async (ticketData) => {
  try {
    // 관리자 및 itsm_team 역할 사용자 이메일 조회
    const adminUsers = await pool.query(
      `SELECT email FROM users WHERE role = 'admin' OR role = 'itsm_team'`
    );
    const recipientEmails = adminUsers.rows.map(user => user.email);

    if (recipientEmails.length === 0) {
      console.warn('알림을 받을 관리자/기술지원팀 이메일이 없습니다.');
      return; // 이메일이 없으면 전송하지 않음
    }

    // 이메일 제목
    const subject = `[BI ITMS] 새로운 기술 지원 티켓 - ${ticketData.urgency} 긴급도`;

    // 이메일 본문 HTML
    const htmlContent = `
    <!-- 프리헤더 -->
    <div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
      고객 ID: ${ticketData.customer_name} / 티켓 ID: #${ticketData.ticketId} / 제목: ${ticketData.title} / 등록 시간: ${ticketData.createdAt}
      ${'&zwnj;'.repeat(500)}
    </div>
    
    <!-- 본문 시작 -->
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3652; text-align: center;">새로운 기술 지원 티켓 알림</h2>
        <div style="background: #f6f8fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
          </p>
          
          <div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #e2e8f0; margin-bottom: 20px;">
            <h3 style="color: #2d3652; margin: 0 0 15px 0;">티켓 정보</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">고객 ID:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.customer_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">티켓 ID:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">#${ticketData.ticketId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">제목:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">긴급도:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">
                  <span style="background-color: ${getUrgencyColor(ticketData.urgency)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${ticketData.urgency}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">등록 시간:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.createdAt}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">관련 제품:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.product || '미지정'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">Component:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.component || '미지정'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">S/W Version:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.sw_version || '미지정'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4a5568;">OS:</td>
                <td style="padding: 8px 0; color: #2d3652;">${ticketData.os || '미지정'}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #e2e8f0; margin-bottom: 20px;">
            <h3 style="color: #2d3652; margin: 0 0 15px 0;">상세 내용</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 3px solid #dee2e6; white-space: pre-wrap; color: #495057; font-size: 14px; line-height: 1.6;">${ticketData.description}</div>
          </div>
          
          ${ticketData.files && ticketData.files.length > 0 ? `
          <div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #e2e8f0; margin-bottom: 20px;">
            <h3 style="color: #2d3652; margin: 0 0 15px 0;">첨부 파일 (${ticketData.files.length}개)</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
              ${ticketData.files.map(file => `
                <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                  <span style="color: #6c757d;">📄</span>
                  <a href="${file.url}" target="_blank" style="color: #007bff; text-decoration: none; font-weight: 500;">${file.originalname}</a>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          <div style="background: #e6ffe6; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #38a169;">
            <p style="color: #2d3652; font-size: 14px; margin: 0;">
              <strong>관리자 페이지</strong>에서 티켓을 <strong>확인하고 처리</strong>할 수 있습니다.
            </p>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/tickets/${ticketData.ticketId}" 
               style="background-color: #2d3652; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                티켓 상세보기
            </a>
          </div>
        </div>
        <p style="color: #7b8190; font-size: 12px; text-align: center;">
          © 2025 ITMS. All rights reserved.
        </p>
      </div>
    `;

    // 이메일 전송
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmails.join(', '), // 조회된 모든 이메일로 전송
      subject: subject,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('관리자 알림 메일 전송 성공:', result.messageId);
    return result;

  } catch (error) {
    console.error('관리자 알림 메일 전송 실패:', error);
    throw error;
  }
};

// 긴급도에 따른 CSS 클래스 반환
const getUrgencyClass = (urgency) => {
  switch (urgency) {
    case '높음': return 'urgency-high';
    case '보통': return 'urgency-medium';
    case '낮음': return 'urgency-low';
    default: return '';
  }
};

// 긴급도에 따른 색상 반환
const getUrgencyColor = (urgency) => {
  switch (urgency) {
    case '높음': return '#dc3545';
    case '보통': return '#ffc107';
    case '낮음': return '#28a745';
    default: return '#6c757d';
  }
};

// 고객에게 티켓 상태 변경 알림 메일 발송 함수
const sendTicketStatusUpdateToCustomer = async (ticketData, customerEmail) => {
  try {
    const subject = `[BI ITMS] 티켓 상태 변경 알림 - #${ticketData.ticketId} ${ticketData.title}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3652; text-align: center;">티켓 상태 변경 알림</h2>
        <div style="background: #f6f8fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
            안녕하세요, 고객님.
          </p>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
            회원님의 티켓 <strong>#<span style="color: #7c83fd;">${ticketData.ticketId}</span> - ${ticketData.title}</strong>의 상태가
            <strong style="color: #7c83fd;">'${ticketData.status}'</strong>(으)로 변경되었습니다.
          </p>
          <div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #e2e8f0; margin-top: 20px;">
            <h3 style="color: #2d3652; margin: 0 0 15px 0;">티켓 정보 요약</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">티켓 ID:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">#${ticketData.ticketId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">제목:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">현재 상태:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">
                  <span style="background-color: ${getUrgencyColor(ticketData.urgency)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${ticketData.status}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4a5568;">긴급도:</td>
                <td style="padding: 8px 0; color: #2d3652;">${ticketData.urgency}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-tickets/${ticketData.ticketId}" 
               style="background-color: #7c83fd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                내 티켓 상세보기
            </a>
          </div>
        </div>
        <p style="color: #7b8190; font-size: 12px; text-align: center;">
          © 2025 ITMS. All rights reserved.
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: subject,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('고객 티켓 상태 변경 알림 메일 전송 성공:', result.messageId);
    return result;

  } catch (error) {
    console.error('고객 티켓 상태 변경 알림 메일 전송 실패:', error);
    throw error;
  }
};

    // 고객 및 관계자에게 티켓 종결 알림 메일 발송 함수
const sendTicketClosedNotification = async (ticketData, recipientEmails) => {
  try {
    const subject = `[BI ITMS] 티켓 종결 알림 - #${ticketData.ticketId} ${ticketData.title}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3652; text-align: center;">티켓 종결 알림</h2>
        <div style="background: #f6f8fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
            안녕하세요.
          </p>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
            기술 지원 티켓 <strong>#<span style="color: #7c83fd;">${ticketData.ticketId}</span> - ${ticketData.title}</strong>이(가)
            <strong style="color: #dc3545;">'종결'</strong> 처리되었습니다.
          </p>
          <div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #e2e8f0; margin-top: 20px;">
            <h3 style="color: #2d3652; margin: 0 0 15px 0;">티켓 정보 요약</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">티켓 ID:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">#${ticketData.ticketId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">제목:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">고객:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #2d3652;">${ticketData.customer_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4a5568;">담당자:</td>
                <td style="padding: 8px 0; color: #2d3652;">${ticketData.assignee_name || '미지정'}</td>
              </tr>
            </table>
          </div>
          <p style="color: #7b8190; font-size: 14px; margin-top: 20px;">
            이 티켓에 대한 모든 지원이 공식적으로 종료되었습니다. 추가 지원이 필요하시면 새 티켓을 생성해 주세요.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-tickets/${ticketData.ticketId}"
               style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                종결된 티켓 확인하기
            </a>
          </div>
        </div>
        <p style="color: #7b8190; font-size: 12px; text-align: center;">
          © 2025 ITMS. All rights reserved.
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmails.join(', '),
      subject: subject,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('종결 알림 메일 전송 성공:', result.messageId);
    return result;

  } catch (error) {
    console.error('종결 알림 메일 전송 실패:', error);
    throw error;
  }
};


module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  sendAdminApprovalNotification,
  sendApprovalEmail,
  sendTicketNotificationToAdmin,
  sendTicketStatusUpdateToCustomer,
  sendTicketClosedNotification
};  