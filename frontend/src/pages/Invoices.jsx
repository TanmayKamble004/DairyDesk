import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useToast } from '../components/Toast'
import { Badge, Card, EmptyRow, LoadFailed, PageHeader, Spinner, Td, Th } from '../components/ui'
import { fmtDateTime } from '../data/storeMock'

const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function Invoices() {
  const toast = useToast()
  const [invoices, setInvoices] = useState(null)
  const [failed, setFailed] = useState(false)
  const [reloads, setReloads] = useState(0)
  // Set when navigating here from an order's "View invoice" link.
  const highlightOrder = useLocation().state?.highlightOrder

  useEffect(() => {
    api
      .get('/invoices/')
      .then((res) => {
        setInvoices(res.data)
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(`Could not load invoices. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloads])

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" />
      {failed && <LoadFailed what="invoices" onRetry={() => setReloads((n) => n + 1)} />}
      {!failed && !invoices && <Spinner />}
      {invoices && (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                {/* The bill number replaces the row id as the identifier on
                    screen: it is what the customer quotes back. */}
                <Th>Bill no.</Th>
                <Th>Issued</Th>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={
                    inv.order === highlightOrder
                      ? 'bg-info-soft text-info-ink'
                      : 'hover:bg-surface-muted'
                  }
                >
                  <Td className="font-medium tabular-nums text-ink">{inv.number}</Td>
                  <Td className="text-muted" title={inv.created_at}>
                    {fmtDateTime(inv.created_at)}
                  </Td>
                  <Td>Order #{inv.order}</Td>
                  <Td>{inv.customer_name}</Td>
                  <Td className="text-right tabular-nums">{formatINR(inv.total_amount)}</Td>
                  <Td className="text-right tabular-nums">{formatINR(inv.paid_amount)}</Td>
                  <Td>
                    <Badge value={inv.status} />
                  </Td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <EmptyRow
                  colSpan={7}
                  title="No invoices yet"
                  detail="Deliver an order to generate one."
                />
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
