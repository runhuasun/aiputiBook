import { BrowserRouter as Router, Route, Link } from 'react-router-dom';
// import Link from "next/link";
import React, { useEffect, useState } from 'react';
import * as du from "../utils/deviceUtils";


interface PaginationProps {
  pageCount: number;
  currentPage: number;
  onPageChange: (pageNumber: number) => void;
}


// const Pagination: React.FC<PaginationProps> = ({ pageCount, currentPage, onPageChange }) => {

export default function Pagination({pageCount, currentPage, onPageChange }:PaginationProps){

  const showPages = du.isMobile() ? 6 : 10;
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  const [goto, setGoto] = useState(currentPage.toString());

  if(pageCount > 1){
    return (
      <Router>
      <div className="flex flex-row items-center mt-4">
        {currentPage > 1 && (
          <Link
            className="page-dark  py-2 px-4 rounded-none"
            to="#"
            onClick={() => onPageChange(1)}
          >
            {'首页'}
          </Link>
        )}
  
        {pageCount>1 && pageNumbers.map((number) => (
          ( 
            ( number < currentPage && (currentPage-number) < (showPages/2) ) || 
            ( number > currentPage && (number-currentPage) < (showPages/2) ) ||
            ( number == currentPage )
           ) && (
          <Link
            key={number}
            className={` py-2 px-4 rounded-none ${number === currentPage ? 'page-main' : 'page-dark'}`}
            to="#"
            onClick={() => onPageChange(number)}
          >
            {number}
          </Link>
            )
        ))}
  
        {(pageCount - currentPage) >= showPages && (
          <Link
            key={currentPage+1}
            className=" py-2 px-4 rounded-none page-dark hidden invisible sm:visible "
            to="#"
            onClick={() => onPageChange(currentPage+1)}
          >
            ......
          </Link>
  
        )}
        
        {currentPage < pageCount && (
          <Link
            className="page-dark py-2 px-4 rounded-none"
            to="#"
            onClick={() => onPageChange(pageCount)}
          >
            {'末页'}
          </Link>
          )}
        
          <input id="iptGoTo" type="text" min='1' step='1' value={goto}  className="page-input w-14 invisible sm:visible "  
            onChange={(e) => setGoto(e.target.value)}          
            />          
          <Link
            className="page-dark py-2 px-4 rounded-none invisible sm:visible"
            to="#"
            onClick={() => {
                if(goto){
                    const nGoto = parseInt(goto);
                    if(isNaN(nGoto) || nGoto<1 || nGoto>pageCount){
                        alert(`请输入1-${pageCount}的数字`);
                    }else{
                        currentPage = nGoto;
                        onPageChange(nGoto)
                    }
                }
            }}
          >
            {'跳转'}
          </Link>
  
      </div>
      </Router>
   
    );
  }else{
   return( <></> );
  }
};

// export default Pagination;
