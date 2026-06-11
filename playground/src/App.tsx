import { useState, useEffect } from 'react'
import { toast } from 'sonner'

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  SidebarSeparator,
  Avatar, AvatarFallback, AvatarImage, AvatarGroup, AvatarGroupCount, AvatarBadge,
  Button,
  Badge,
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Input,
  Label,
  Textarea,
  Checkbox,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Separator,
  Skeleton,
  Spinner,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Tooltip, TooltipTrigger, TooltipContent,
  Alert, AlertTitle, AlertDescription,
  Toaster,
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage,
  DataTable, createSelectColumn, type ColumnDef,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@surfnet/sds-ng'
import {
  IconLayoutDashboard,
  IconForms,
  IconTable,
  IconBell,
  IconTypography,
  IconSettings,
  IconHelp,
  IconChevronDown,
  IconCircleCheck,
  IconInfoCircle,
  IconAlertTriangle,
  IconAlertCircle,
  IconDotsVertical,
  IconNetwork,
  IconServer,
  IconBuildingCommunity,
  IconSun,
  IconMoon,
} from '@tabler/icons-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'overview' | 'form' | 'table' | 'data-table' | 'feedback' | 'typography'

// ─── Mock data ────────────────────────────────────────────────────────────────

const institutions = [
  { id: 1, name: 'Westmere University', contact: 'j.dejong@westmere.nl', role: 'Admin', status: 'Active', joined: '2022-03-14' },
  { id: 2, name: 'Nordhaven Polytechnic', contact: 'r.smits@nordhaven.nl', role: 'Manager', status: 'Active', joined: '2021-11-02' },
  { id: 3, name: 'Lakeside Research Institute', contact: 'a.bakker@lakeside.nl', role: 'Viewer', status: 'Inactive', joined: '2023-01-19' },
  { id: 4, name: 'Elmwood College', contact: 'm.vander@elmwood.nl', role: 'Manager', status: 'Active', joined: '2020-07-08' },
  { id: 5, name: 'Stonegate Academy', contact: 'p.hoek@stonegate.nl', role: 'Admin', status: 'Pending', joined: '2024-02-27' },
  { id: 6, name: 'Rivercrest Institute', contact: 'l.kuiper@rivercrest.nl', role: 'Viewer', status: 'Active', joined: '2023-09-05' },
  { id: 7, name: 'Brookfield University', contact: 'e.visser@brookfield.nl', role: 'Manager', status: 'Inactive', joined: '2022-06-21' },
]

// ─── Data-table column definitions ───────────────────────────────────────────

type Institution = typeof institutions[number]

const institutionColumns: ColumnDef<Institution>[] = [
  createSelectColumn<Institution>(),
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Institution
        <span className="ml-1 opacity-60">
          {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : '↕'}
        </span>
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 font-medium">
        <Avatar size="sm">
          <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(row.getValue('name'))}`} />
          <AvatarFallback>{(row.getValue('name') as string).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {row.getValue('name')}
      </div>
    ),
  },
  {
    accessorKey: 'contact',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Contact
        <span className="ml-1 opacity-60">
          {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : '↕'}
        </span>
      </Button>
    ),
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('contact')}</span>,
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Role
        <span className="ml-1 opacity-60">
          {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : '↕'}
        </span>
      </Button>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
    enableSorting: false,
  },
  {
    accessorKey: 'joined',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Joined
        <span className="ml-1 opacity-60">
          {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : '↕'}
        </span>
      </Button>
    ),
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('joined')}</span>,
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      const inst = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <span className="sr-only">Open menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(inst.contact)}>
              Copy email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Edit institution</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

// ─── Sidebar nav config ───────────────────────────────────────────────────────

const navItems: { page: Page; label: string; icon: React.ReactNode; children?: { label: string; page: Page }[] }[] = [
  { page: 'overview',   label: 'Overview',    icon: <IconLayoutDashboard size={16} /> },
  { page: 'form',       label: 'Form',        icon: <IconForms size={16} /> },
  { page: 'table',      label: 'Table',       icon: <IconTable size={16} /> },
  { page: 'data-table', label: 'Data Table',  icon: <IconTable size={16} /> },
  { page: 'feedback',   label: 'Feedback',    icon: <IconBell size={16} /> },
  { page: 'typography', label: 'Typography',  icon: <IconTypography size={16} /> },
]

const accountItems = [
  { label: 'Settings', icon: <IconSettings size={16} /> },
  { label: 'Support',  icon: <IconHelp size={16} /> },
]

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'Active'   ? 'default' :
    status === 'Inactive' ? 'secondary' :
    'outline'
  return <Badge variant={variant}>{status}</Badge>
}

// ─── Page: Overview ───────────────────────────────────────────────────────────

function OverviewPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>All button variants and sizes</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button size="xs">XSmall</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </CardFooter>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>All badge variants</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
        </CardContent>
      </Card>

      {/* Avatars */}
      <Card>
        <CardHeader>
          <CardTitle>Avatars</CardTitle>
          <CardDescription>Sizes, badges and groups</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <Avatar size="sm">
              <AvatarImage src="https://api.dicebear.com/9.x/initials/svg?seed=WU" />
              <AvatarFallback>WU</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarImage src="https://api.dicebear.com/9.x/initials/svg?seed=NP" />
              <AvatarFallback>NP</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarImage src="https://api.dicebear.com/9.x/initials/svg?seed=LR" />
              <AvatarFallback>LR</AvatarFallback>
              <AvatarBadge className="bg-green-500" />
            </Avatar>
          </div>
          <AvatarGroup>
            {['EC', 'SA', 'RC', 'BU'].map((i) => (
              <Avatar key={i} size="sm">
                <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${i}`} />
                <AvatarFallback>{i}</AvatarFallback>
              </Avatar>
            ))}
            <AvatarGroupCount count={12} />
          </AvatarGroup>
        </CardContent>
      </Card>

      {/* Tooltip */}
      <Card>
        <CardHeader>
          <CardTitle>Tooltip</CardTitle>
          <CardDescription>Hover the buttons to see tooltips</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon"><IconNetwork size={16} /></Button>
            </TooltipTrigger>
            <TooltipContent>Network overview</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon"><IconServer size={16} /></Button>
            </TooltipTrigger>
            <TooltipContent>Server status</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon"><IconBuildingCommunity size={16} /></Button>
            </TooltipTrigger>
            <TooltipContent>Institutions</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      {/* Spinner + Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Loading states</CardTitle>
          <CardDescription>Spinner and skeleton placeholders</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Spinner className="size-5 text-primary" />
            <span className="text-sm text-muted-foreground">Processing…</span>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>

      {/* Separator */}
      <Card>
        <CardHeader>
          <CardTitle>Separator</CardTitle>
          <CardDescription>Horizontal and vertical</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm">Section A</span>
            <Separator />
            <span className="text-sm">Section B</span>
            <Separator />
            <span className="text-sm">Section C</span>
          </div>
          <div className="flex h-6 items-center gap-3">
            <span className="text-sm">Alpha</span>
            <Separator orientation="vertical" />
            <span className="text-sm">Beta</span>
            <Separator orientation="vertical" />
            <span className="text-sm">Gamma</span>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

// ─── Page: Form ───────────────────────────────────────────────────────────────

function FormPage() {
  const [submitted, setSubmitted] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  function handleReset() {
    setSubmitted(false)
    setAgreed(false)
    setName('')
    setEmail('')
    setRole('')
    setMessage('')
  }

  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Institution onboarding</CardTitle>
          <CardDescription>Register a new institution on the SURFnet platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted && (
            <Alert className="mb-6">
              <IconCircleCheck className="size-4" />
              <AlertTitle>Submission received</AlertTitle>
              <AlertDescription>
                Thank you, <strong>{name || 'your institution'}</strong>. We will review and be in touch shortly.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst-name">Institution name</Label>
              <Input
                id="inst-name"
                placeholder="e.g. Westmere University"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst-email">Contact email</Label>
              <Input
                id="inst-email"
                type="email"
                placeholder="contact@institution.nl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst-role">Role</Label>
              <Select value={role} onValueChange={setRole} required>
                <SelectTrigger id="inst-role">
                  <SelectValue placeholder="Select a role…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst-message">Additional notes</Label>
              <Textarea
                id="inst-message"
                placeholder="Any context or requirements…"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="inst-agree"
                checked={agreed}
                onCheckedChange={v => setAgreed(v === true)}
                required
              />
              <Label htmlFor="inst-agree" className="font-normal">
                I confirm this institution is authorised to join the SURFnet platform
              </Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit">Submit</Button>
              <Button type="button" variant="outline" onClick={handleReset}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page: Table ─────────────────────────────────────────────────────────────

function TablePage() {
  const [alertRow, setAlertRow] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {alertRow !== null && (
        <Alert>
          <IconInfoCircle className="size-4" />
          <AlertTitle>Action triggered</AlertTitle>
          <AlertDescription>
            You triggered an action for <strong>{institutions[alertRow - 1]?.name}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registered institutions</CardTitle>
          <CardDescription>All institutions currently onboarded to the SURFnet platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(inst.name)}`} />
                        <AvatarFallback>{inst.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {inst.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{inst.contact}</TableCell>
                  <TableCell>{inst.role}</TableCell>
                  <TableCell><StatusBadge status={inst.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{inst.joined}</TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setAlertRow(inst.id)}>
                          <IconDotsVertical size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Actions</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableCaption>
              Showing {institutions.length} institutions. Data is for showcase purposes only.
            </TableCaption>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page: Data Table ─────────────────────────────────────────────────────────

function DataTablePage() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Registered institutions</CardTitle>
          <CardDescription>
            Powered by @tanstack/react-table — sorting, filtering, pagination and column visibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={institutionColumns}
            data={institutions}
            filterColumn="contact"
            filterPlaceholder="Filter by contact email…"
            defaultPageSize={4}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function FeedbackPage() {
  return (
    <div className="max-w-2xl">
      <Tabs defaultValue="alerts">
        <TabsList variant="line">
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="toasts">Toasts</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="flex flex-col gap-4 mt-4">
          <Alert>
            <IconInfoCircle className="size-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              Your SURFnet federation metadata was successfully synchronised.
            </AlertDescription>
          </Alert>

          <Alert>
            <IconCircleCheck className="size-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Nordhaven Polytechnic has been approved and added to the platform.
            </AlertDescription>
          </Alert>

          <Alert>
            <IconAlertTriangle className="size-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Stonegate Academy's certificate expires in 14 days. Please renew it before it lapses.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <IconAlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Unable to reach Rivercrest Institute's identity provider. Check the endpoint configuration.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="toasts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Toast notifications</CardTitle>
              <CardDescription>Trigger different toast types using the buttons below.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => toast.success('Metadata synchronised successfully.')}>
                Success toast
              </Button>
              <Button variant="outline" onClick={() => toast.info('New federation policy published.')}>
                Info toast
              </Button>
              <Button variant="outline" onClick={() => toast.warning('Certificate expires in 14 days.')}>
                Warning toast
              </Button>
              <Button variant="outline" onClick={() => toast.error('Identity provider unreachable.')}>
                Error toast
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Page: Typography ────────────────────────────────────────────────────────

function TypographyPage() {
  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Type scale</CardTitle>
          <CardDescription>Headings and body text using the active theme fonts.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold tracking-tight">Heading 1 — SURFnet Design System</h1>
          <Separator />
          <h2 className="text-3xl font-semibold tracking-tight">Heading 2 — Federation Services</h2>
          <Separator />
          <h3 className="text-2xl font-semibold">Heading 3 — Identity &amp; Access</h3>
          <Separator />
          <h4 className="text-xl font-medium">Heading 4 — Institution Management</h4>
          <Separator />
          <p className="text-base leading-7">
            Body text — SURFnet provides collaborative digital infrastructure for Dutch education and research.
            Institutions rely on our federated identity platform to enable seamless, secure access to services
            across the network.
          </p>
          <p className="text-sm text-muted-foreground">
            Small / muted — Last synchronised: 10 June 2026 at 09:42 UTC
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monospace</CardTitle>
          <CardDescription>Code and technical identifiers using the mono font.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <code className="font-mono text-sm bg-muted px-2 py-1 rounded-md block">
            entityID: https://idp.westmere.nl/saml2/idp/metadata
          </code>
          <code className="font-mono text-sm bg-muted px-2 py-1 rounded-md block">
            urn:surfnet:diensten:eduroam:2024
          </code>
          <code className="font-mono text-sm bg-muted px-2 py-1 rounded-md block">
            POST /api/v2/institutions/onboard HTTP/1.1
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colour tokens</CardTitle>
          <CardDescription>Core semantic colours from the active Figma theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Primary',     bg: 'bg-primary',     text: 'text-primary-foreground' },
              { label: 'Secondary',   bg: 'bg-secondary',   text: 'text-secondary-foreground' },
              { label: 'Muted',       bg: 'bg-muted',       text: 'text-muted-foreground' },
              { label: 'Accent',      bg: 'bg-accent',      text: 'text-accent-foreground' },
              { label: 'Destructive', bg: 'bg-destructive', text: 'text-destructive-foreground' },
              { label: 'Card',        bg: 'bg-card border', text: 'text-card-foreground' },
            ].map(({ label, bg, text }) => (
              <div key={label} className={`rounded-lg p-4 ${bg}`}>
                <span className={`text-sm font-medium ${text}`}>{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── App shell ────────────────────────────────────────────────────────────────

const pageTitles: Record<Page, string> = {
  overview:     'Overview',
  form:         'Form',
  table:        'Table',
  'data-table': 'Data Table',
  feedback:     'Feedback',
  typography:   'Typography',
}

const themes: { value: string; label: string }[] = [
  { value: '',                          label: 'SURF Blue (default)' },
  { value: 'theme-surf-turquoise',      label: 'SURF Turquoise' },
  { value: 'theme-surf-green',          label: 'SURF Green' },
  { value: 'theme-surf-purple',         label: 'SURF Purple' },
  { value: 'theme-surf-orange',         label: 'SURF Orange' },
  { value: 'theme-surf-yellow',         label: 'SURF Yellow' },
  { value: 'theme-groenvermogen-nkph2', label: 'Groenvermogen / NKPH2' },
  { value: 'theme-studielink-aii',      label: 'Studielink Aii' },
  { value: 'theme-shadcn-default',      label: 'ShadCN default' },
  { value: 'theme-maartje',             label: 'Maartje' },
]

export default function App() {
  const [activePage, setActivePage] = useState<Page>('overview')
  const [platformOpen, setPlatformOpen] = useState(true)
  const [theme, setTheme] = useState('')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const html = document.documentElement
    html.classList.forEach(cls => { if (cls.startsWith('theme-')) html.classList.remove(cls) })
    if (theme) html.classList.add(theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <SidebarProvider>
      <Toaster />
      <Sidebar collapsible="icon">

        {/* Header */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="gap-3">
                <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  SN
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-sm">SURFnet</span>
                  <span className="text-xs text-muted-foreground">Design System</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        {/* Main nav */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Components</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>

                {/* Platform with collapsible sub-items */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setPlatformOpen(o => !o)}
                    isActive={['form', 'table', 'data-table', 'feedback', 'typography'].includes(activePage)}
                    tooltip="Platform"
                  >
                    <IconLayoutDashboard size={16} />
                    <span>Platform</span>
                    <IconChevronDown
                      size={14}
                      className={`ml-auto transition-transform duration-200 ${platformOpen ? 'rotate-180' : ''}`}
                    />
                  </SidebarMenuButton>
                  {platformOpen && (
                    <SidebarMenuSub>
                      {navItems.filter(i => i.page !== 'overview').map(item => (
                        <SidebarMenuSubItem key={item.page}>
                          <SidebarMenuSubButton
                            isActive={activePage === item.page}
                            onClick={() => setActivePage(item.page)}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                {/* Top-level Overview */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activePage === 'overview'}
                    onClick={() => setActivePage('overview')}
                    tooltip="Overview"
                  >
                    <IconLayoutDashboard size={16} />
                    <span>Overview</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Account group */}
          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {accountItems.map(item => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton tooltip={item.label}>
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="gap-3">
                <Avatar size="sm" className="shrink-0">
                  <AvatarImage src="https://api.dicebear.com/9.x/initials/svg?seed=Admin" />
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium">Admin User</span>
                  <span className="text-xs text-muted-foreground">admin@surfnet.nl</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Main content */}
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 items-center gap-3 border-b px-4 shrink-0">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitles[activePage]}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDark(d => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </Button>

            <Select
              value={theme || '__default__'}
              onValueChange={v => setTheme(v === '__default__' ? '' : v)}
            >
              <SelectTrigger size="sm" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map(t => (
                  <SelectItem key={t.value || '__default__'} value={t.value || '__default__'}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {activePage === 'overview'    && <OverviewPage />}
          {activePage === 'form'        && <FormPage />}
          {activePage === 'table'       && <TablePage />}
          {activePage === 'data-table'  && <DataTablePage />}
          {activePage === 'feedback'    && <FeedbackPage />}
          {activePage === 'typography'  && <TypographyPage />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
