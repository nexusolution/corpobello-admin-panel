'use client'

import Image from 'next/image'

// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import { Card } from '@/components/ui/card'

// Import Swiper styles
import 'swiper/css'
import Link from 'next/link'

const TopCards = () => {
  const TopCardInfo = [
    {
      key: 'card1',
      title: 'Invoices',
      desc: '59',
      img: '/images/svgs/icon-connect.svg',
      bgcolor: 'bg-lightprimary dark:bg-lightprimary ',
      textclr: 'text-primary dark:text-primary',
      url: '/apps/invoice/list',
    },
    {
      key: 'card2',
      title: 'Chats',
      desc: '3,560',
      img: '/images/svgs/icon-speech-bubble.svg',
      bgcolor: 'bg-lightsuccess dark:bg-lightsuccess',
      textclr: 'text-success dark:text-success',
      url: '/apps/chats',
    },
    {
      key: 'card3',
      title: 'Blogs',
      desc: '696',
      img: '/images/svgs/icon-favorites.svg',
      bgcolor: 'bg-lighterror dark:bg-lighterror',
      textclr: 'text-error dark:text-error',
      url: '/apps/blog/post',
    },
    {
      key: 'card4',
      title: 'Emails',
      desc: '356',
      img: '/images/svgs/icon-mailbox.svg',
      bgcolor: 'bg-lightsecondary dark:bg-lightsecondary',
      textclr: 'text-secondary dark:text-secondary',
      url: '/apps/email',
    },
    {
      key: 'card5',
      title: 'Products',
      desc: '$96k',
      img: '/images/svgs/icon-briefcase.svg',
      bgcolor: 'bg-lightwarning dark:bg-lightwarning',
      textclr: 'text-warning dark:text-warning',
      url: '/apps/ecommerce/shop',
    },
    {
      key: 'card6',
      title: 'Followers',
      desc: '96',
      img: '/images/svgs/icon-user-male.svg',
      bgcolor: 'bg-lightprimary dark:bg-lightprimary',
      textclr: 'text-primary dark:text-primary',
      url: '/apps/user-profile/followers',
    },
    {
      key: 'card7',
      title: 'Blogs',
      desc: '696',
      img: '/images/svgs/icon-favorites.svg',
      bgcolor: 'bg-lighterror dark:bg-lighterror',
      textclr: 'text-error dark:text-error',
      url: '/apps/blog/post',
    },
  ]

  return (
    <>
      <div>
        <Swiper
          slidesPerView={6}
          spaceBetween={24}
          loop={true}
          freeMode={false}
          grabCursor={true}
          speed={5000}
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
          }}
          modules={[Autoplay]}
          breakpoints={{
            0: { slidesPerView: 1, spaceBetween: 10 },
            640: { slidesPerView: 2, spaceBetween: 14 },
            768: { slidesPerView: 3, spaceBetween: 18 },
            1030: { slidesPerView: 4, spaceBetween: 18 },
            1200: { slidesPerView: 6, spaceBetween: 24 },
          }}
          className='mySwiper'>
          {TopCardInfo.map((item) => {
            return (
              <SwiperSlide key={item.key}>
                <Link href={item.url}>
                  <Card
                    className={`shadow-none ${item.bgcolor} border-0 w-full`}>
                    <div className='text-center'>
                      <div className='flex justify-center'>
                        <Image
                          src={item.img}
                          width='50'
                          height='50'
                          className='mb-3'
                          alt='profile-image'
                        />
                      </div>
                      <p className={`font-semibold ${item.textclr} mb-1`}>
                        {item.title}
                      </p>
                      <h5
                        className={`text-lg font-semibold ${item.textclr} mb-0`}>
                        {item.desc}
                      </h5>
                    </div>
                  </Card>
                </Link>
              </SwiperSlide>
            )
          })}
        </Swiper>
      </div>
    </>
  )
}
export default TopCards