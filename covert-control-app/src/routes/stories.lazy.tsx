import { createLazyFileRoute } from '@tanstack/react-router'
import { db } from '../config/firebase'
import { useEffect, useState } from 'react'
import { getDocs, collection } from 'firebase/firestore'

export const Route = createLazyFileRoute('/stories')({
  component: RouteComponent,
})

function RouteComponent() {
  const [storyList, setStoryList] = useState<any[]>([])
  const storyCollectionRef = collection(db, 'stories')

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const storiesCollection = await getDocs(storyCollectionRef)
        const filteredData = storiesCollection.docs.map((doc) => ({...doc.data(), id: doc.id}))
        setStoryList(filteredData)
      } catch (error) {
        console.error("Error fetching stories:", error)
      }
    }
    fetchStories();
  }, [])


  return <div>Hello "/stories"!
    <ul>
      {storyList.map((story) => (
        <li key={story.id}>
          <h3>{story.title}</h3>
          <p>{story.description}</p>
        </li>
      ))}
    </ul>
  </div>
}
