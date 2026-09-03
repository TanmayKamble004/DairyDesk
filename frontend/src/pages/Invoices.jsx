import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { Badge, Card, EmptyRow, ErrorAlert, PageHeader, Spinner, Td, Th } from '../components/ui'

const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function Invoices() {
  const [invoices, setInvoices] = useState(null)
  const [error, setError] = useState('')
  // Set when navigating here from an order's "View invoice" link.
  const highlightOrder = useLocation().state?.highlightOrder

  useEffect(() => {
    api
      .get('/invoices/')
      .then((res) => setInvoices(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" />
      {error && <ErrorAlert message={error} />}
      {!error && !invoices && <Spinner />}
      {invoices && (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                <Th>Invoice</Th>
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
                  <Td className="font-medium text-ink">#{inv.id}</Td>
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
                  colSpan={6}
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
