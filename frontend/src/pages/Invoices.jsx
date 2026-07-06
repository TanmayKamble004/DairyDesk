import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { Badge, Card, ErrorAlert, PageHeader, Spinner, Td, Th } from '../components/ui'

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
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <Th>Invoice</Th>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={
                    inv.order === highlightOrder ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }
                >
                  <Td className="font-medium text-slate-800">#{inv.id}</Td>
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
                <tr>
                  <Td className="py-8 text-center text-slate-400" colSpan={6}>
                    No invoices yet — deliver an order to generate one.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
