"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import CardBox from "../shared/CardBox"; // keep your custom wrapper

interface ProductType {
  photo: any;
  title: string;
  price: number;
  salesPrice: number;
  rating: number;
}

export const Product = ({
  photo,
  title,
  price,
  salesPrice,
  rating,
}: ProductType) => {
  // Generate an array for rating stars
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Icon
        key={index}
        icon="tabler:star-filled"
        className={cn(
          "h-4 w-4",
          index < rating ? "text-yellow-400" : "text-gray-300"
        )}
      />
    ));
  };

  return (
    <CardBox className="p-0 overflow-hidden group card-hover">
      <div className="relative">
        <Link href={`/`}>
          <div className="overflow-hidden h-[265px] w-full">
            <Image
              src={photo}
              alt={title}
              height={265}
              width={500}
              className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </Link>

        <div className="p-6 pt-4">
          <div className="relative flex justify-between items-center -mt-8 z-10">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="rounded-full h-9 w-9 ms-auto bg-primary hover:bg-primary/90"
                  >
                    <Icon icon="tabler:basket" height={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Cart</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <h6 className="text-base mt-2 line-clamp-1 group-hover:text-primary transition-colors">
            {title}
          </h6>

          <div className="flex justify-between items-center mt-1">
            <h5 className="text-base flex gap-2 items-center">
              ${price}
              <span className="font-normal text-sm text-muted-foreground line-through">
                ${salesPrice}
              </span>
            </h5>

            <div className="flex items-center gap-0.5">{renderStars(rating)}</div>
          </div>
        </div>
      </div>
    </CardBox>
  );
};
