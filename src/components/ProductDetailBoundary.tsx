import React from 'react';

/** Keep the marketplace usable if a detail chunk or its contents cannot load. */
export class ProductDetailBoundary extends React.Component<{
  children: React.ReactNode;
  onClose: () => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="ui-dialog fixed inset-0 z-50 flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="product-detail-error-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 id="product-detail-error-title" className="ui-banner ui-card-title rounded-2xl px-4 py-3 text-white">Chưa thể mở chi tiết trái cây</h2>
        <p role="alert" className="text-body">Kết nối có thể bị gián đoạn hoặc website vừa được cập nhật. Bạn có thể quay lại sạp hoặc tải lại trang để mở vườn và nhật ký.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="ui-button-primary px-4 py-2" onClick={() => window.location.reload()}>Tải lại trang</button>
          <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-ink" onClick={this.props.onClose}>Đóng và về sạp</button>
        </div>
      </section>
    </div>;
  }
}
