import { Routes, Route, Navigate } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Stations from "@/pages/Stations";
import StationMap from "@/pages/StationMap";
import Electricity from "@/pages/Electricity";
import Rent from "@/pages/Rent";
import Brands from "@/pages/Brands";
import Entities from "@/pages/Entities";
import Landlords from "@/pages/Landlords";
import Shareholders from "@/pages/Shareholders";
import Contracts from "@/pages/Contracts";
import Approvals from "@/pages/Approvals";
import Meters from "@/pages/Meters";
import Directory from "@/pages/Directory";

export default function App() {
  return (
    <>
      <Toaster richColors position="top-center" />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stations" element={<Stations />} />
          <Route path="/station-map" element={<StationMap />} />
          <Route path="/electricity" element={<Electricity />} />
          <Route path="/rent" element={<Rent />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/entities" element={<Entities />} />
          <Route path="/landlords" element={<Landlords />} />
          <Route path="/shareholders" element={<Shareholders />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/meters" element={<Meters />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
