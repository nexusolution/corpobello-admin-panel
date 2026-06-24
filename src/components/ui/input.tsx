import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Focus convention across the project: solid 2px border that turns primary
// on focus. No ring/shadow. Variant base widths stay 2 always so focus
// doesn't shift layout.
const inputVariants = cva(
  'flex h-10 w-full border-2 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:rounded-sm file:text-sm file:font-medium file:text-primary file:mr-5 focus-visible:outline-0 focus-visible:ring-0',
  {
    variants: {
      variant: {
        default:
          'border-ld bg-transparent text-ld placeholder:text-muted-foreground dark:placeholder:text-white/30 focus-visible:border-primary',
        gray:
          'border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500 focus-visible:border-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400',
        info:
          'border-info bg-info/10 text-info placeholder-info/50 focus-visible:border-info dark:border-info dark:bg-info/10',
        failure:
          'border-error bg-error/10 text-error placeholder-error/50 focus-visible:border-error dark:border-error dark:bg-error/10',
        warning:
          'border-warning bg-warning/10 text-warning placeholder-warning/50 focus-visible:border-warning dark:border-warning dark:bg-warning/10',
        success:
          'border-success bg-success/10 text-success placeholder-success/50 focus-visible:border-success dark:border-success dark:bg-success/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
  VariantProps<typeof inputVariants> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
