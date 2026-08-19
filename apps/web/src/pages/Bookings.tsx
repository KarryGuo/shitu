import { useApp } from '../stores/app'
import { useReveal } from '../hooks/useReveal'
import { SectionHead, EmptyState } from '../components/ui'

const statusMeta: Record<string, { label: string; cls: string }> = {
  proposed: { label: '待确认', cls: 'bg-[#F7EED8] text-[#8C6A1E]' },
  confirmed: { label: '已确认', cls: 'bg-hwy-tint text-hwy-deep' },
  done: { label: '已完成', cls: 'bg-[#E8EEF4] text-[#3A6B8C]' },
  cancelled: { label: '已取消', cls: 'bg-concrete-2 text-faint' },
}

export default function Bookings() {
  const bookings = useApp((s) => s.bookings)
  const setBookingStatus = useApp((s) => s.setBookingStatus)
  const revealRef = useReveal()

  return (
    <div ref={revealRef} className="pb-10">
      <SectionHead
        kicker="BOOKINGS · 门店预约"
        title="预约单"
        sub="所有预约带幂等键创建，重复提交不会重复落单；确认类动作全部经确认单执行。"
      />

      {bookings.length === 0 ? (
        <EmptyState text="暂无预约单 · 去「保养」或「理赔」发起任务后自动生成" />
      ) : (
        <div className="flex flex-col gap-3.5">
          {bookings.map((b, i) => {
            const m = statusMeta[b.status]
            return (
              <div key={b.id} className="card card-lift reveal flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <b className="text-[17px]">{b.shopName}</b>
                    <span className={`text-[12.5px] font-bold rounded-md px-2 py-0.5 ${m.cls}`}>{m.label}</span>
                  </div>
                  <div className="text-sub text-[14px] mt-0.5">
                    {b.startsAt} · {b.items} · 预估 {b.priceEstimate}
                  </div>
                </div>
                {(b.status === 'proposed' || b.status === 'confirmed') && (
                  <div className="flex gap-2.5">
                    {b.status === 'proposed' && (
                      <button className="btn btn-ink !py-2 !px-4 !text-[14px]" onClick={() => setBookingStatus(b.id, 'confirmed')}>
                        确认预约
                      </button>
                    )}
                    <button
                      className="btn btn-ghost !py-2 !px-4 !text-[14px] !border-line !text-sub"
                      onClick={() => setBookingStatus(b.id, 'cancelled')}
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
