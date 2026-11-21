/** 公开首页：无需登录即可查看。 */
import { AuthNavbar, PublicPageFooter } from '@/components/common/AuthNavbar'

export function Home() {
  return (
    <div className="min-h-screen bg-slate-50 transition-colors duration-200 dark:bg-slate-900">
      <AuthNavbar />
      <main className="mx-auto max-w-[90rem] px-3 pb-10 pt-20 sm:px-6">
        <PublicPageFooter />
      </main>
    </div>
  )
}
