import { uniqueId } from 'lodash'

export interface ChildItem {
  id?: number | string
  name?: string
  icon?: any
  children?: ChildItem[]
  item?: any
  url?: any
  color?: string
  disabled?: boolean
  subtitle?: string
  badge?: boolean
  badgeType?: string
  isPro?: boolean
}

export interface MenuItem {
  heading?: string
  name?: string
  icon?: any
  id?: number
  to?: string
  items?: MenuItem[]
  children?: ChildItem[]
  url?: any
  disabled?: boolean
  subtitle?: string
  badgeType?: string
  badge?: boolean
  isPro?: boolean
}

const SidebarContent: MenuItem[] = [
  {
    heading: "Home",
    children: [
      {
        name: "Dashboard",
        icon: 'solar:widget-add-line-duotone',
        id: uniqueId(),
        url: "/",
      },
      {
        name: "eCommerce",
        icon: 'solar:cart-3-line-duotone',
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/dashboards/eCommerce",
        isPro: true,
      },
      {
        name: 'Front Pages',
        id: uniqueId(),
        icon: 'solar:home-angle-linear',
        url: '#',
        children: [
          {
            name: "Homepage",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/frontend-pages/homepage",
            isPro: true
          },
          {
            name: "About Us",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/frontend-pages/about",
            isPro: true
          },
          {
            name: "Blog",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/frontend-pages/blog/post",
            isPro: true
          },
          {
            name: "Blog Details",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/frontend-pages/blog/detail/as-yen-tumbles-gadget-loving-japan-goes-for-secondhand-iphones-",
            isPro: true
          },
          {
            name: "Contact Us",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/frontend-pages/contact",
            isPro: true
          },
          {
            name: "Portfolio",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/frontend-pages/portfolio",
            isPro: true
          },
          {
            name: "Pricing",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/frontend-pages/pricing",
            isPro: true
          },
        ],
      },
    ],
  },
  {
    heading: 'AI',
    children: [
      {
        name: 'Ai Table Builder',
        icon: 'solar:server-linear',
        id: uniqueId(),
        url: 'https://tailwindbuilder.ai/table-builder',
        isPro: false,

      },
      {
        name: 'Ai Form Builder',
        icon: 'solar:document-add-linear',
        id: uniqueId(),
        url: 'https://tailwindbuilder.ai/form-builder',
        isPro: false,

      },
      {
        id: uniqueId(),
        name: 'Ai Chart Builder',
        icon: 'solar:pie-chart-2-linear',
        url: 'https://tailwindbuilder.ai/chart-builder',
        isPro: false,

      },
    ],
  },
  {
    heading: 'pages',
    children: [
      {
        name: 'Table',
        icon: 'solar:server-linear',
        id: uniqueId(),
        url: '/utilities/table',
      },
      {
        name: "Typography",
        icon: 'solar:text-circle-outline',
        id: uniqueId(),
        url: "/utilities/typography",
      },
      {
        name: 'Form',
        icon: 'solar:document-add-linear',
        id: uniqueId(),
        url: '/utilities/form',
      },
      {
        name: "Shadow",
        icon: "solar:airbuds-case-charge-outline",
        id: uniqueId(),
        url: "/utilities/shadow",
      },
      {
        id: uniqueId(),
        name: 'User Profile',
        icon: 'solar:user-circle-linear',
        url: '/user-profile',
        isPro: false,
      },
    ],
  },
  {
    heading: 'Apps',
    children: [
      {
        id: uniqueId(),
        name: 'Notes',
        icon: 'solar:notes-linear',
        url: '/apps/notes',
        isPro: false,
      },
      {
        id: uniqueId(),
        name: 'Tickets',
        icon: 'solar:ticker-star-linear',
        url: '/apps/tickets',
        isPro: false,
      },
      {
        name: 'Blogs',
        id: uniqueId(),
        url: '#',
        icon: 'solar:sort-by-alphabet-linear',
        children: [
          {
            id: uniqueId(),
            name: 'Blog Post',
            url: '/apps/blog/post',
            isPro: false,
          },
          {
            id: uniqueId(),
            name: 'Blog Detail',
            url: '/apps/blog/detail/streaming-video-way-before-it-was-cool-go-dark-tomorrow',
            isPro: false,
          },
        ],
      },
      {
        id: uniqueId(),
        name: 'Contacts',
        icon: 'solar:users-group-rounded-linear',
        url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/contacts',
        isPro: true,
      },
      {
        name: 'Ecommerce',
        id: uniqueId(),
        url: '#',
        icon: 'solar:cart-large-2-linear',
        children: [
          {
            id: uniqueId(),
            name: 'Shop',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/ecommerce/shop',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Details',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/ecommerce/detail/3',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'List',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/ecommerce/list',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Checkout',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/ecommerce/checkout',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Add Product',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/ecommerce/addproduct',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Edit Product',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/ecommerce/editproduct',
            isPro: true,
          },
        ],
      },
      {
        name: 'User Profile',
        id: uniqueId(),
        url: '#',
        icon: 'solar:user-circle-linear',
        children: [
          {
            id: uniqueId(),
            name: 'Profile',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/user-profile/profile',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Followers',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/user-profile/followers',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Friends',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/user-profile/friends',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Gallery',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/user-profile/gallery',
            isPro: true,
          },
        ],
      },
      {
        name: 'Invoice',
        id: uniqueId(),
        icon: 'solar:bill-list-linear',
        url: '#',
        children: [
          {
            id: uniqueId(),
            name: 'List',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/invoice/list',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Details',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/invoice/detail/PineappleInc',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Create',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/invoice/create',
            isPro: true,
          },
          {
            id: uniqueId(),
            name: 'Edit',
            url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/invoice/edit/PineappleInc',
            isPro: true,
          },
        ],
      },
      {
        id: uniqueId(),
        name: 'Chats',
        icon: 'solar:dialog-linear',
        url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/chats',
        isPro: true,
      },
      {
        id: uniqueId(),
        name: 'Calendar',
        icon: 'solar:calendar-linear',
        url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/calendar',
        isPro: true,
      },
      {
        id: uniqueId(),
        name: 'Email',
        icon: 'solar:letter-linear',
        url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/email',
        isPro: true,
      },
      {
        id: uniqueId(),
        name: 'Kanban',
        icon: 'solar:server-minimalistic-linear',
        url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/kanban',
        isPro: true,
      }
    ],
  },
  {
    heading: "UI ELEMENTS",
    children: [

      {
        name: "Flowbite Ui",
        id: uniqueId(),
        icon: "solar:widget-linear",
        children: [
          {
            id: uniqueId(),
            name: "Accordian",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/accrodian",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Badge",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/badge",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Button",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/buttons",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Dropdowns",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/dropdown",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Modals",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/modals",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Tab",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/tab",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Tooltip",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/tooltip",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Alert",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/alert",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Progressbar",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/progressbar",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Pagination",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/pagination",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Breadcrumbs",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/breadcrumb",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Drawer",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/drawer",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Lists",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/listgroup",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Carousel",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/carousel",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Spinner",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/spinner",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Avatar",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/avatar",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Banner",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/banner",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Button Group",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/button-group",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Card",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/card",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Datepicker",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/datepicker",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Footer",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/footer",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "KBD",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/kbd",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Mega Menu",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/megamenu",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Navbar",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/navbar",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Popover",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/popover",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Rating",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/rating",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Sidebar",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/sidebar",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Tables",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/tables",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Timeline",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/timeline",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Toast",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/toast",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Typography",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/ui-components/typography",
            isPro: true,
          },
        ],
      },
      {
        name: "Shadcn Ui",
        id: uniqueId(),
        icon: "solar:adhesive-plaster-outline",
        children: [
          {
            id: uniqueId(),
            name: "Badge",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/badge",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Button",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/buttons",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Dropdowns",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/dropdown",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Dialogs",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/dialogs",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Alert",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/alert",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Toast",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/toast",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Breadcrumbs",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/breadcrumb",
            isPro: true,
          },

          {
            id: uniqueId(),
            name: "Carousel",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/carousel",
            isPro: true,
          },

          {
            id: uniqueId(),
            name: "Card",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/card",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Datepicker",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/datepicker",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Combobox",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/combobox",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Collapsible",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/collapsible",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Command",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/command",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Skeleton",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/skeleton",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Avatar",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/avatar",
            isPro: true,
          },

          {
            id: uniqueId(),
            name: "Tooltip",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/tooltip",
            isPro: true,
          },
          {
            name: "Accordion",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/accordion",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Tab",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/tab",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Progressbar",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/progressbar",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Drawer",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-ui/drawer",
            isPro: true,
          },
        ],
      },
      {
        name: "Headless Ui",
        id: uniqueId(),
        icon: "tabler:brand-headlessui",
        children: [
          {
            name: "Dropdown",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-ui/dropdown",
            isPro: true,
          },
          {
            name: "Disclosure",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-ui/disclosure",
            isPro: true,
          },
          {
            name: "Dialog",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-ui/dialog",
            isPro: true,
          },
          {
            name: "Popover",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-ui/popover",
            isPro: true,
          },
          {
            name: "Tabs",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-ui/tabs",
            isPro: true,
          },
          {
            name: "Transition",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-ui/transition",
            isPro: true,
          },
        ],
      },
    ],
  },
  {
    heading: "FORM ELEMENTS",
    children: [

      {
        name: "Flowbite Forms",
        id: uniqueId(),
        icon: "solar:notes-minimalistic-linear",
        children: [
          {
            id: uniqueId(),
            name: "Forms Elements",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/forms/form-elements",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Forms Layouts",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/forms/form-layouts",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Forms Horizontal",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/forms/form-horizontal",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Forms Vertical",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/forms/form-vertical",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Forms Custom",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/forms/form-custom",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Form Validation",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/forms/form-validation",
            isPro: true,
          },
        ],
      },
      {
        name: "Shadcn Forms",
        id: uniqueId(),
        icon: "solar:widget-6-line-duotone",
        children: [
          {
            id: uniqueId(),
            name: "Input",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-form/input",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Select",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-form/select",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Checkbox",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-form/checkbox",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Radio",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-form/radio",
            isPro: true,
          },
        ],
      },
      {
        name: "Headless Forms",
        id: uniqueId(),
        icon: "solar:documents-linear",
        children: [
          {
            id: uniqueId(),
            name: "Buttons",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/buttons",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Checkbox",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/checkbox",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Combobox",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/combobox",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Fieldset",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/fieldset",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Input",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/input",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Listbox",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/listbox",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Radio Group",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/radiogroup",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Select",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/select",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Switch",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/switch",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Textarea",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/headless-form/textarea",
            isPro: true,
          },
        ],
      },
    ],
  },
  {
    heading: "Pages",
    children: [
      {
        name: "Account Setting",
        icon: "solar:user-circle-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/theme-pages/account-settings",
        isPro: true,
      },
      {
        name: "FAQ",
        icon: "solar:question-circle-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/theme-pages/faq",
        isPro: true,
      },
      {
        name: "Pricing",
        icon: "solar:dollar-minimalistic-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/theme-pages/pricing",
        isPro: true,
      },
      {
        name: "Landingpage",
        icon: "solar:screencast-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/landingpage",
        isPro: true,
      },
      {
        name: "Roll Base Access",
        icon: "solar:snowflake-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/theme-pages/casl",
        isPro: true,
      },
    ],
  },
  {
    heading: "Widgets",
    children: [
      {
        id: uniqueId(),
        name: "Cards",
        icon: "solar:copy-linear",
        url: "https://modernize-tailwind-nextjs-main.vercel.app/widgets/cards",
        isPro: true,
      },
      {
        id: uniqueId(),
        name: "Banners",
        icon: "solar:banknote-2-linear",
        url: "https://modernize-tailwind-nextjs-main.vercel.app/widgets/banners",
        isPro: true,
      },
      {
        id: uniqueId(),
        name: "Charts",
        icon: "solar:chart-square-linear",
        url: "https://modernize-tailwind-nextjs-main.vercel.app/widgets/charts",
        isPro: true,
      },
    ],
  },
  {
    heading: "TABLES",
    children: [

      {
        name: "MUI Tables",
        id: uniqueId(),
        icon: "solar:database-linear",
        children: [
          {
            name: "Basic Tables",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/tables/basic",
            isPro: true,
          },
          {
            name: "Striped Rows Table",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/tables/striped-row",
            isPro: true,
          },
          {
            name: "Hover Table",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/tables/hover-table",
            isPro: true,
          },
          {
            name: "Checkbox Table",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/tables/checkbox-table",
            isPro: true,
          },
        ],
      },
      {
        name: "Shadcn Tables",
        id: uniqueId(),
        icon: "solar:tablet-linear",
        children: [
          {
            name: "Basic Table",
            id: uniqueId(),
            url: "https://modernize-tailwind-nextjs-main.vercel.app/shadcn-tables/basic",
            isPro: true,
          },
        ],
      },
      {
        name: "React Tables",
        id: uniqueId(),
        icon: "solar:bedside-table-linear",
        children: [
          {
            id: uniqueId(),
            name: "Basic",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/basic",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Dense",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/dense",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Sorting",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/sorting",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Filtering",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/filtering",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Pagination",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/pagination",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Row Selection",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/row-selection",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Column Visibility",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/columnvisibility",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Editable",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/editable",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Sticky",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/sticky",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Drag & Drop",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/drag-drop",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Empty",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/empty",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Expanding",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/react-tables/expanding",
            isPro: true,
          },

        ],
      },
    ],
  },
  {
    heading: "Charts",
    children: [
      {
        name: "Line Chart",
        icon: "solar:diagram-up-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/charts/line",
        isPro: true,
      },
      {
        name: "Area Chart",
        icon: "solar:graph-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/charts/area",
        isPro: true,
      },
      {
        name: "Gradient Chart",
        icon: "solar:graph-new-up-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/charts/gradient",
        isPro: true,
      },
      {
        name: "Candlestick",
        icon: "solar:transmission-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/charts/candlestick",
        isPro: true,
      },
      {
        name: "Column",
        icon: "solar:chart-2-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/charts/column",
        isPro: true,
      },
      {
        name: "Doughnut & Pie",
        icon: "solar:pie-chart-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/charts/doughnut",
        isPro: true,
      },
      {
        name: "Radialbar & Radar",
        icon: "solar:pie-chart-2-linear",
        id: uniqueId(),
        url: "https://modernize-tailwind-nextjs-main.vercel.app/charts/radialbar",
        isPro: true,
      },
    ],
  },
  {
    heading: "Icons",
    children: [
      {
        id: uniqueId(),
        name: "Tabler Icons",
        icon: "solar:black-hole-linear",
        url: "https://modernize-tailwind-nextjs-main.vercel.app/icons/tabler",
        isPro: true,
      },
      {
        id: uniqueId(),
        name: "Iconify Icons",
        icon: "solar:smile-circle-linear",
        url: "https://modernize-tailwind-nextjs-main.vercel.app/icons/iconify",
        isPro: true,
      },
    ],
  },
  {
    heading: "Auth",
    children: [
      {
        id: uniqueId(),
        name: "Error",
        icon: "solar:folder-error-linear",
        url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/error",
        isPro: true,
      },
      {
        name: "Login",
        id: uniqueId(),
        icon: "solar:login-linear",
        children: [
          {
            id: uniqueId(),
            name: "Side Login",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth1/login",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Boxed Login",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth2/login",
            isPro: true,
          }
        ],
      },
      {
        name: "Register",
        id: uniqueId(),
        icon: "solar:user-plus-rounded-linear",
        children: [
          {
            id: uniqueId(),
            name: "Side Register",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth1/register",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Boxed Register",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth2/register",
            isPro: true,
          }
        ],
      },
      {
        name: "Forgot Password",
        id: uniqueId(),
        icon: "solar:password-linear",
        children: [
          {
            id: uniqueId(),
            name: "Side Forgot Pwd",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth1/forgot-password",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Boxed Forgot Pwd",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth2/forgot-password",
            isPro: true,
          }
        ],
      },
      {
        name: "Two Steps",
        id: uniqueId(),
        icon: "solar:shield-network-linear",
        children: [
          {
            id: uniqueId(),
            name: "Side Two Steps",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth1/two-steps",
            isPro: true,
          },
          {
            id: uniqueId(),
            name: "Boxed Two Steps",
            url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/auth2/two-steps",
            isPro: true,
          }
        ],
      },
      {
        id: uniqueId(),
        name: "Maintenance",
        icon: "solar:settings-linear",
        url: "https://modernize-tailwind-nextjs-main.vercel.app/auth/maintenance",
        isPro: true,
      },
    ],
  },
  {
    heading: "Auth",
    children: [
      {
        name: "Login",
        icon: "solar:login-2-linear",
        id: uniqueId(),
        url: "/auth/login",
      },
      {
        name: "Register",
        icon: "solar:shield-user-outline",
        id: uniqueId(),
        url: "/auth/register",
      },
    ],
  },
  {
    heading: "Extra",
    children: [
      {
        name: "Icons",
        icon: "solar:sticker-smile-circle-outline",
        id: uniqueId(),
        url: "/icons/tabler",
      },
      {
        name: "Sample Page",
        icon: "solar:notes-minimalistic-outline",
        id: uniqueId(),
        url: "/sample-page",
      },
    ],
  }
]

export default SidebarContent
